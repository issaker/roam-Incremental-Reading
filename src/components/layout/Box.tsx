import styled from '@emotion/styled';
import { DetailedHTMLProps, HTMLAttributes } from 'react';

// Define a mapping for spacing props to CSS properties
const spacingProps = {
  m: 'margin',
  mt: 'marginTop',
  mr: 'marginRight',
  mb: 'marginBottom',
  ml: 'marginLeft',
  mx: 'marginLeft,marginRight',
  my: 'marginTop,marginBottom',
  p: 'padding',
  pt: 'paddingTop',
  pr: 'paddingRight',
  pb: 'paddingBottom',
  pl: 'paddingLeft',
  px: 'paddingLeft,paddingRight',
  py: 'paddingTop,paddingBottom',
};

type SpacingProps = {
  [K in keyof typeof spacingProps]?: string | number;
};

// Define other common style props
type StyleProps = SpacingProps & {
  width?: string | number;
  height?: string | number;
  display?: string;
  flex?: string | number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  alignItems?: string;
  justifyContent?: string;
  flexDirection?: string;
  flexWrap?: string;
  gap?: string | number;
  bg?: string;
  borderRadius?: string | number;
  border?: string;
  as?: keyof JSX.IntrinsicElements | React.ComponentType<any>;
};

// Combine with standard div element props
export type BoxProps = StyleProps & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

// Helper to convert prop values to CSS values (e.g., add 'px')
const toPx = (value: string | number) => (typeof value === 'number' ? `${value}px` : value);

// The Box component
const Box = styled.div<BoxProps>`
  box-sizing: border-box;

  /* Generate CSS from style props */
  ${(props) => props.width && `width: ${toPx(props.width)};`}
  ${(props) => props.height && `height: ${toPx(props.height)};`}
  ${(props) => props.display && `display: ${props.display};`}
  ${(props) => props.flex && `flex: ${props.flex};`}
  ${(props) => props.flexGrow && `flex-grow: ${props.flexGrow};`}
  ${(props) => props.flexShrink && `flex-shrink: ${props.flexShrink};`}
  ${(props) => props.flexBasis && `flex-basis: ${props.flexBasis};`}
  ${(props) => props.alignItems && `align-items: ${props.alignItems};`}
  ${(props) => props.justifyContent && `justify-content: ${props.justifyContent};`}
  ${(props) => props.flexDirection && `flex-direction: ${props.flexDirection};`}
  ${(props) => props.flexWrap && `flex-wrap: ${props.flexWrap};`}
  ${(props) => props.gap && `gap: ${toPx(props.gap)};`}
  ${(props) => props.bg && `background-color: ${props.bg};`}
  ${(props) => props.borderRadius && `border-radius: ${toPx(props.borderRadius)};`}
  ${(props) => props.border && `border: ${props.border};`}

  /* Generate CSS from spacing props */
  ${(props) =>
    Object.entries(spacingProps)
      .map(([propName, cssProperty]) => {
        const propValue = props[propName as keyof SpacingProps];
        if (propValue !== undefined) {
          const cssValue = toPx(propValue);
          return cssProperty.split(',').map(property => `${property}: ${cssValue};`).join('');
        }
        return '';
      })
      .join('\n')}
`;

export default Box; 