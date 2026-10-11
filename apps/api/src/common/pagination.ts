import { ApiPropertyOptional } from '@nestjs/swagger';
import type { PaginatedResponse } from '@teranga-fleet/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export function skipTake(query: PaginationQueryDto) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

export function paginated<T>(
  data: T[],
  total: number,
  query: PaginationQueryDto,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}
