import { fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Icon, iconMap } from './Icon';

describe('Icon', () => {
  describe('Basic Rendering', () => {
    it('renders icon correctly', () => {
      const { container } = render(<Icon type="menu" size="md" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders with correct display name', () => {
      expect(Icon.displayName).toBe('Icon');
    });
  });

  describe('Icon Types', () => {
    it('renders menu icon', () => {
      const { container } = render(<Icon type="menu" size="md" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders chevron-left icon', () => {
      const { container } = render(<Icon type="chevron-left" size="md" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders house icon', () => {
      const { container } = render(<Icon type="house" size="md" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders circle-check icon', () => {
      const { container } = render(<Icon type="circle-check" size="md" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders all icon types from iconMap', () => {
      const iconTypes = Object.keys(iconMap);
      expect(iconTypes.length).toBeGreaterThan(0);

      iconTypes.forEach((type) => {
        const { container } = render(<Icon type={type as keyof typeof iconMap} size="md" />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });
  });

  describe('Size Variants', () => {
    it('renders sm size (16px)', () => {
      const { container } = render(<Icon type="menu" size="sm" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('h-4');
      expect(svg).toHaveClass('w-4');
    });

    it('renders md size (20px)', () => {
      const { container } = render(<Icon type="menu" size="md" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('h-5');
      expect(svg).toHaveClass('w-5');
    });

    it('renders lg size (24px)', () => {
      const { container } = render(<Icon type="menu" size="lg" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('h-6');
      expect(svg).toHaveClass('w-6');
    });

    it('renders xl size (28px)', () => {
      const { container } = render(<Icon type="menu" size="xl" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('h-7');
      expect(svg).toHaveClass('w-7');
    });
  });

  describe('Custom Props', () => {
    it('applies custom className', () => {
      const { container } = render(<Icon type="menu" size="md" className="custom-class" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('custom-class');
    });

    it('applies custom style', () => {
      const { container } = render(<Icon type="menu" size="md" style={{ color: 'red' }} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });

    it('forwards SVG props', () => {
      const { container } = render(
        <Icon type="menu" size="md" data-testid="test-icon" aria-label="Menu icon" />
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('data-testid', 'test-icon');
      expect(svg).toHaveAttribute('aria-label', 'Menu icon');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('applies onClick handler', () => {
      let clicked = false;
      const handleClick = () => {
        clicked = true;
      };
      const { container } = render(<Icon type="menu" size="md" onClick={handleClick} />);
      const svg = container.querySelector('svg');
      if (svg) {
        fireEvent.click(svg);
      }
      expect(clicked).toBe(true);
    });
  });

  describe('Ref Forwarding', () => {
    it('forwards ref correctly', () => {
      const ref = createRef<SVGSVGElement>();
      const { container } = render(<Icon type="menu" size="md" ref={ref} />);
      const svg = container.querySelector('svg');
      expect(ref.current).toBe(svg);
    });
  });
});
