import { ApiProperty } from '@nestjs/swagger';

export class DmLocationResponseDto {
  @ApiProperty({ example: 5, description: 'Delivery man ID' })
  delivery_man_id: number;

  @ApiProperty({ example: '53.7632', description: 'Latitude as string (from delivery_histories table)' })
  latitude: string;

  @ApiProperty({ example: '-2.7050', description: 'Longitude as string (from delivery_histories table)' })
  longitude: string;

  @ApiProperty({ example: '123 Main St, Preston', nullable: true, description: 'Human-readable address' })
  location: string | null;

  @ApiProperty({ example: '2026-03-16T03:01:00.000Z', description: 'When location was last updated' })
  updated_at: Date;
}
