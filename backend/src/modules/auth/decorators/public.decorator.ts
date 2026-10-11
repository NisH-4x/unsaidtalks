import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Every route requires a signed-in user unless it is explicitly marked public. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
