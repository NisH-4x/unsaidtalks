import { Transform, TransformFnParams } from 'class-transformer';

export function Trim(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  );
}

export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim().toLowerCase() : (value as unknown),
  );
}

/** Form fields arrive as strings; "true" and "false" become booleans, anything else is left to fail validation. */
export function ToBoolean(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as unknown;
  });
}
