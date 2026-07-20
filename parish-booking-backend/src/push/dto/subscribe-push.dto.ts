import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

class PushKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

export class SubscribePushDto {
  @IsString()
  endpoint: string;

  // The browser's PushSubscription.toJSON() always includes this field, and the
  // global ValidationPipe runs with forbidNonWhitelisted — so omitting it here
  // made every real subscribe attempt fail with
  // "property expirationTime should not exist". We accept and ignore it.
  @IsOptional()
  expirationTime?: number | null;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}
