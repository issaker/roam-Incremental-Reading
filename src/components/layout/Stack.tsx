import React from 'react';
import Box, { BoxProps } from './Box';

// Extend BoxProps for Stack-specific properties
export interface StackProps extends BoxProps {
  direction?: 'row' | 'column';
  as?: keyof JSX.IntrinsicElements | React.ComponentType<any>;
}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ direction = 'column', as, ...props }, ref) => {
    return (
      <Box
        ref={ref}
        as={as}
        display="flex"
        flexDirection={direction}
        {...props}
      />
    );
  }
);

Stack.displayName = 'Stack';

export default Stack; 