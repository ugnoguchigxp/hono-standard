import * as React from 'react';

import { Button, type ButtonProps } from './button';

const IconButton = React.forwardRef<HTMLButtonElement, Omit<ButtonProps, 'size'>>(
  ({ ...props }, ref) => <Button ref={ref} size="icon" {...props} />
);
IconButton.displayName = 'IconButton';

export { IconButton };
