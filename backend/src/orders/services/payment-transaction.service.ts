import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderTransaction } from '../entities/order-transaction.entity';
import { OrderPayment } from '../entities/order-payment.entity';
import { AdminWallet } from '../entities/admin-wallet.entity';
import { RestaurantWallet } from '../entities/restaurant-wallet.entity';

interface Restaurant {
  id: number;
  vendor_id: number;
  name: string;
  restaurant_model: string; // 'subscription' | 'commission' | 'unsubscribed'
  comission?: number;
  self_delivery_system: number;
  // ... other fields
}

@Injectable()
export class PaymentTransactionService {
  private readonly logger = new Logger(PaymentTransactionService.name);

  constructor(
    @InjectRepository(OrderTransaction)
    private transactionRepo: Repository<OrderTransaction>,
    @InjectRepository(OrderPayment)
    private paymentRepo: Repository<OrderPayment>,
    @InjectRepository(AdminWallet)
    private adminWalletRepo: Repository<AdminWallet>,
    @InjectRepository(RestaurantWallet)
    private restaurantWalletRepo: Repository<RestaurantWallet>,
  ) {}

  /**
   * Main method: Create transaction when order is delivered
   * This replicates Laravel's OrderLogic::create_transaction()
   */
  async createTransactionForDeliveredOrder(
    manager: EntityManager,
    order: Order,
  ): Promise<boolean> {
    this.logger.log(`💰 Creating transaction for order: ${order.id}`);

    try {
      // 1. Check if transaction already exists
      const existingTransaction = await manager.findOne(OrderTransaction, {
        where: { order_id: order.id },
      });

      if (existingTransaction) {
        this.logger.log(`Transaction already exists for order ${order.id}`);
        return true;
      }

      // 2. Get restaurant details
      const restaurant = await this.getRestaurantDetails(manager, order.restaurant_id);

      // 3. Get restaurant subscription (if exists)
      const restaurantSub = await this.getRestaurantSubscription(manager, restaurant.id);

      // 4. Calculate all transaction amounts
      const transactionData = await this.calculateTransactionAmounts(
        order,
        restaurant,
        restaurantSub,
      );

      // 5. Create transaction record
      await this.saveTransaction(manager, order, restaurant, transactionData);

      // 6. Update wallets (THIS UPDATES THE GRAPH!) ✨ ADD THIS
      await this.updateWallets(manager, order, restaurant, transactionData);

      // 7. Update payment status
      await this.updatePaymentStatus(manager, order);

      this.logger.log(`✅ Transaction created successfully for order ${order.id}`);
      return true;

    } catch (error) {
      this.logger.error(`❌ Failed to create transaction for order ${order.id}:`, error);
      return false;
    }
  }

  /**
   * Get restaurant details with vendor info
   */
  private async getRestaurantDetails(
    manager: EntityManager,
    restaurantId: number,
  ): Promise<Restaurant> {
    const restaurant = await manager
      .createQueryBuilder()
      .select('*')
      .from('restaurants', 'r')
      .where('r.id = :restaurantId', { restaurantId })
      .getRawOne();

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    return restaurant;
  }

  /**
   * Get active restaurant subscription
   */
  private async getRestaurantSubscription(
    manager: EntityManager,
    restaurantId: number,
  ): Promise<any | null> {
    const subscription = await manager
      .createQueryBuilder()
      .select('*')
      .from('restaurant_subscriptions', 'rs')
      .where('rs.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('rs.status = :status', { status: 1 })
      .orderBy('rs.id', 'DESC')
      .limit(1)
      .getRawOne();

    return subscription;
  }

  /**
   * Calculate all transaction amounts
   * This is the core logic from Laravel's OrderLogic::create_transaction()
   */
  private async calculateTransactionAmounts(
    order: Order,
    restaurant: Restaurant,
    restaurantSub: any | null,
  ) {
    // Get commission rate
    const defaultCommission = 10; // TODO: Get from business_settings
    const commissionRate = restaurant.comission ?? defaultCommission;

    // Calculate base order amount (excluding fees)
    const orderAmount = 
      parseFloat(order.order_amount) 
      - parseFloat(order.additional_charge || '0')
      - parseFloat(order.extra_packaging_amount || '0')
      - parseFloat(order.delivery_charge || '0')
      - parseFloat(order.total_tax_amount || '0')
      - parseFloat(order.dm_tips || '0')
      + parseFloat(order.coupon_discount_amount || '0')
      + parseFloat(order.restaurant_discount_amount || '0')
      + parseFloat(order.ref_bonus_amount || '0');

    // Determine commission based on restaurant model
    let commissionAmount = 0;
    let subscriptionMode = 0;
    let commissionPercentage = 0;

    if (restaurant.restaurant_model === 'subscription' && restaurantSub) {
      // Subscription restaurants pay NO commission
      commissionAmount = 0;
      subscriptionMode = 1;
      commissionPercentage = 0;
      this.logger.log(`Restaurant is subscribed - NO COMMISSION`);
    } else {
      // Commission restaurants pay percentage
      commissionAmount = (orderAmount / 100) * commissionRate;
      subscriptionMode = 0;
      commissionPercentage = commissionRate;
      this.logger.log(`Commission restaurant - ${commissionPercentage}% = $${commissionAmount.toFixed(2)}`);
    }

    // Calculate delivery charge commission
    let commissionOnDelivery = 0;
    let commissionOnActualDeliveryFee = 0;

    const hasSelfDelivery = 
      (restaurant.restaurant_model === 'subscription' && restaurantSub?.self_delivery === 1) ||
      (restaurant.restaurant_model !== 'subscription' && restaurant.self_delivery_system === 1);

    if (!hasSelfDelivery) {
      const deliveryChargeCommissionPercentage = 10; // TODO: Get from business_settings
      commissionOnDelivery = (deliveryChargeCommissionPercentage / 100) * parseFloat(order.original_delivery_charge || '0');
      commissionOnActualDeliveryFee = parseFloat(order.delivery_charge) > 0 ? commissionOnDelivery : 0;
    }

    // Calculate subsidies and discounts
    const adminSubsidy = order.free_delivery_by === 'admin' ? parseFloat(order.original_delivery_charge || '0') : 0;
    const restaurantSubsidy = order.free_delivery_by === 'vendor' ? parseFloat(order.original_delivery_charge || '0') : 0;
    
    const adminCouponDiscount = order.coupon_created_by === 'admin' ? parseFloat(order.coupon_discount_amount || '0') : 0;
    const restaurantCouponDiscount = order.coupon_created_by === 'vendor' ? parseFloat(order.coupon_discount_amount || '0') : 0;
    
    const restaurantDiscountAmount = parseFloat(order.restaurant_discount_amount || '0');
    const refBonusAmount = parseFloat(order.ref_bonus_amount || '0');

    // Calculate restaurant amount
    const restaurantAmount = 
      orderAmount 
      + parseFloat(order.total_tax_amount || '0')
      + parseFloat(order.extra_packaging_amount || '0')
      - commissionAmount
      - restaurantCouponDiscount;

    // Calculate admin commission
    const adminCommission = 
      commissionAmount 
      + parseFloat(order.additional_charge || '0')
      - adminSubsidy
      - adminCouponDiscount
      - restaurantDiscountAmount;

    // Determine who received payment
    const receivedBy = 
      order.payment_method === 'cash_on_delivery' 
        ? 'restaurant'
        : 'admin';

    return {
      orderAmount: parseFloat(order.order_amount),
      restaurantAmount,
      adminCommission,
      commissionAmount,
      commissionPercentage,
      subscriptionMode,
      deliveryCharge: parseFloat(order.delivery_charge || '0') - commissionOnActualDeliveryFee,
      originalDeliveryCharge: parseFloat(order.original_delivery_charge || '0') - commissionOnDelivery,
      deliveryFeeCommission: commissionOnActualDeliveryFee,
      tax: parseFloat(order.total_tax_amount || '0'),
      adminExpense: adminSubsidy + adminCouponDiscount + restaurantDiscountAmount + refBonusAmount,
      restaurantExpense: restaurantSubsidy + restaurantCouponDiscount,
      discountAmountByRestaurant: restaurantCouponDiscount,
      receivedBy,
    };
  }

  /**
   * Save transaction to database
   */
  private async saveTransaction(
    manager: EntityManager,
    order: Order,
    restaurant: Restaurant,
    transactionData: any,
  ) {
    const transaction = manager.create(OrderTransaction, {
      vendor_id: restaurant.vendor_id,
      delivery_man_id: order.delivery_man_id,
      order_id: order.id,
      order_amount: transactionData.orderAmount,
      restaurant_amount: transactionData.restaurantAmount,
      admin_commission: transactionData.adminCommission,
      delivery_charge: transactionData.deliveryCharge,
      original_delivery_charge: transactionData.originalDeliveryCharge,
      tax: transactionData.tax,
      received_by: transactionData.receivedBy,
      zone_id: order.zone_id,
      status: 'approved',
      dm_tips: parseFloat(order.dm_tips || '0'),
      delivery_fee_comission: transactionData.deliveryFeeCommission,
      admin_expense: transactionData.adminExpense,
      restaurant_expense: transactionData.restaurantExpense,
      is_subscribed: transactionData.subscriptionMode,
      commission_percentage: transactionData.commissionPercentage,
      discount_amount_by_restaurant: transactionData.discountAmountByRestaurant,
      is_subscription: order.subscription_id ? 1 : 0,
      additional_charge: parseFloat(order.additional_charge || '0'),
      extra_packaging_amount: parseFloat(order.extra_packaging_amount || '0'),
      ref_bonus_amount: parseFloat(order.ref_bonus_amount || '0'),
    });

    await manager.save(transaction);

    // Log summary
    this.logger.log(`📊 Transaction Summary for Order ${order.id}:`);
    this.logger.log(`   Restaurant: ${restaurant.name}`);
    this.logger.log(`   Model: ${restaurant.restaurant_model}`);
    this.logger.log(`   Commission Rate: ${transactionData.commissionPercentage}%`);
    this.logger.log(`   Restaurant Amount: $${transactionData.restaurantAmount.toFixed(2)}`);
    this.logger.log(`   Admin Commission: $${transactionData.adminCommission.toFixed(2)}`);
    this.logger.log(`   Received By: ${transactionData.receivedBy}`);
  }

  /**
 * Update wallet balances (THIS IS WHAT UPDATES THE GRAPH!)
 * Replicates Laravel's wallet update logic (lines 142-203 in OrderLogic.php)
 */
private async updateWallets(
  manager: EntityManager,
  order: Order,
  restaurant: Restaurant,
  transactionData: any,
) {
  this.logger.log(`💳 Updating wallet balances for order ${order.id}`);

  // 1. Get or create Admin Wallet (admin_id = 1)
  let adminWallet = await manager.findOne(AdminWallet, {
    where: { admin_id: 1 },
  });

  if (!adminWallet) {
  adminWallet = manager.create(AdminWallet, {
    admin_id: 1,
    total_commission_earning: 0,
    digital_received: 0,
    manual_received: 0,
    delivery_charge: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

  // 2. Get or create Restaurant Wallet
  let restaurantWallet = await manager.findOne(RestaurantWallet, {
    where: { vendor_id: restaurant.vendor_id },
  });

  if (!restaurantWallet) {
    restaurantWallet = manager.create(RestaurantWallet, {
      vendor_id: restaurant.vendor_id,
      total_earning: 0,
      total_withdrawn: 0,
      pending_withdraw: 0,
      collected_cash: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  // 3. Update Admin Wallet
  adminWallet.total_commission_earning += transactionData.adminCommission + transactionData.deliveryFeeCommission;
  
  if (transactionData.receivedBy === 'admin') {
    // Digital payment - admin receives
    adminWallet.digital_received += parseFloat(order.order_amount) - parseFloat(order.partially_paid_amount || '0');
  } else if (transactionData.receivedBy === false) {
    // Manual payment
    adminWallet.manual_received += parseFloat(order.order_amount) - parseFloat(order.partially_paid_amount || '0');
  }

  // If not self-delivery, admin gets delivery charge commission
  const hasSelfDelivery = 
    (restaurant.restaurant_model === 'subscription') ||
    (restaurant.restaurant_model !== 'subscription' && restaurant.self_delivery_system === 1);

  if (!hasSelfDelivery) {
    adminWallet.delivery_charge += transactionData.deliveryCharge;
  }

  adminWallet.updated_at = new Date();

  // 4. Update Restaurant Wallet
  restaurantWallet.total_earning += transactionData.restaurantAmount;

  if (transactionData.receivedBy === 'restaurant') {
    // COD - restaurant collects cash
    restaurantWallet.collected_cash += parseFloat(order.order_amount) - parseFloat(order.partially_paid_amount || '0');
  }

  // If self-delivery, restaurant gets delivery fees
  if (hasSelfDelivery) {
    restaurantWallet.total_earning += parseFloat(order.delivery_charge || '0') + parseFloat(order.dm_tips || '0');
  }

  restaurantWallet.updated_at = new Date();

  // 5. Save wallets
  await manager.save(AdminWallet, adminWallet);
  await manager.save(RestaurantWallet, restaurantWallet);

  this.logger.log(`✅ Wallets updated:`);
  this.logger.log(`   Admin commission: +$${transactionData.adminCommission.toFixed(2)}`);
  this.logger.log(`   Restaurant earning: +$${transactionData.restaurantAmount.toFixed(2)}`);
}

  /**
   * Update payment status and unpaid records
   */
  private async updatePaymentStatus(manager: EntityManager, order: Order) {
    // Mark order as paid
    order.payment_status = 'paid';

    // Update unpaid order_payments records to paid
    await manager.update(
      OrderPayment,
      { 
        order_id: order.id,
        payment_status: 'unpaid',
      },
      { 
        payment_status: 'paid',
      }
    );

    this.logger.log(`✅ Payment status updated to 'paid' for order ${order.id}`);
  }

  
}