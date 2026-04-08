import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  Accordion,
  AccordionContent,
  AccordionContentFooter,
  AccordionContentSection,
  AccordionItem,
  AccordionTrigger,
} from './Accordion';

describe('Accordion', () => {
  describe('Basic Rendering', () => {
    it('renders correctly with required props', () => {
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>Test Item</AccordionTrigger>
            <AccordionContent>Test Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });

    it('renders with structured content sections', () => {
      render(
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>Test Item</AccordionTrigger>
            <AccordionContent>
              <AccordionContentSection>Section Content</AccordionContentSection>
              <AccordionContentFooter>Footer Content</AccordionContentFooter>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
      expect(screen.getByText('Section Content')).toBeInTheDocument();
      expect(screen.getByText('Footer Content')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('expands and collapses on trigger click', async () => {
      const user = userEvent.setup();
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>Test Item</AccordionTrigger>
            <AccordionContent>Test Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      const trigger = screen.getByText('Test Item');

      // Initially closed - content not in document
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();

      // Click to open
      await user.click(trigger);
      expect(screen.getByText('Test Content')).toBeVisible();

      // Click to close
      await user.click(trigger);
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('supports multiple type - multiple items can be open', async () => {
      const user = userEvent.setup();
      render(
        <Accordion type="multiple">
          <AccordionItem value="item-1">
            <AccordionTrigger>Item 1</AccordionTrigger>
            <AccordionContent>Content 1</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Item 2</AccordionTrigger>
            <AccordionContent>Content 2</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      await user.click(screen.getByText('Item 1'));
      await user.click(screen.getByText('Item 2'));

      expect(screen.getByText('Content 1')).toBeVisible();
      expect(screen.getByText('Content 2')).toBeVisible();
    });

    it('respects defaultValue prop', () => {
      render(
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>Test Item</AccordionTrigger>
            <AccordionContent>Test Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      expect(screen.getByText('Test Content')).toBeVisible();
    });

    it('supports disabled items', () => {
      const { container } = render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1" disabled>
            <AccordionTrigger>Disabled Item</AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      const trigger = container.querySelector('button[data-state]');
      expect(trigger).toBeDisabled();
    });
  });

  describe('Variants', () => {
    it.each([
      ['default', 'bg-background', 'border-border'],
      ['destructive', 'bg-accordion-destructive-bg', 'border-accordion-destructive-border'],
      ['warning', 'bg-accordion-warning-bg', 'border-accordion-warning-border'],
      ['success', 'bg-accordion-success-bg', 'border-accordion-success-border'],
    ])('renders %s variant with correct styles', (variant, expectedBg, expectedBorder) => {
      const { container } = render(
        <Accordion type="single" collapsible>
          <AccordionItem
            value="item-1"
            variant={variant as 'default' | 'destructive' | 'warning' | 'success'}
          >
            <AccordionTrigger
              variant={variant as 'default' | 'destructive' | 'warning' | 'success'}
            >
              Item
            </AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      const trigger = container.querySelector('button[data-state]');
      expect(trigger).toHaveClass(expectedBg);
      expect(trigger).toHaveClass(expectedBorder);
    });

    it('shows status label for non-default variants', () => {
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1" variant="destructive">
            <AccordionTrigger variant="destructive">Item</AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      expect(screen.getByText('要改善')).toBeInTheDocument();
    });

    it('hides status label when showStatusLabel is false', () => {
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1" variant="destructive">
            <AccordionTrigger variant="destructive" showStatusLabel={false}>
              Item
            </AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      expect(screen.queryByText('要改善')).not.toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('applies custom className to AccordionItem', () => {
      const { container } = render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1" className="custom-item-class">
            <AccordionTrigger>Item</AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );
      const item = container.querySelector('[data-state]');
      expect(item).toHaveClass('custom-item-class');
    });

    it('renders with badge', () => {
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger badge="優先度TOP1">Item with Badge</AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );
      expect(screen.getByText('優先度TOP1')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger label="課題1.1">Item with Label</AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );
      expect(screen.getByText('課題1.1')).toBeInTheDocument();
    });

    it('applies custom className to AccordionTrigger', () => {
      const { container } = render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger className="custom-trigger-class">Item</AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );
      const trigger = container.querySelector('button.custom-trigger-class');
      expect(trigger).toBeInTheDocument();
    });

    it('applies custom className to AccordionContent', () => {
      const { container } = render(
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>Item</AccordionTrigger>
            <AccordionContent className="custom-content-class">Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );
      const content = container.querySelector('.custom-content-class');
      expect(content).toBeInTheDocument();
    });

    it('applies custom className to AccordionContentSection', () => {
      const { container } = render(
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>Item</AccordionTrigger>
            <AccordionContent>
              <AccordionContentSection className="custom-section-class">
                Section
              </AccordionContentSection>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
      const section = container.querySelector('.custom-section-class');
      expect(section).toBeInTheDocument();
    });

    it('applies custom className to AccordionContentFooter', () => {
      const { container } = render(
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>Item</AccordionTrigger>
            <AccordionContent>
              <AccordionContentFooter className="custom-footer-class">
                Footer
              </AccordionContentFooter>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
      const footer = container.querySelector('.custom-footer-class');
      expect(footer).toBeInTheDocument();
    });
  });

  describe('Border and Rounded Styles', () => {
    it('applies rounded-lg when closed', () => {
      const { container } = render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>Item</AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      const trigger = container.querySelector("button[data-state='closed']");
      expect(trigger).toHaveClass('data-[state=closed]:rounded-lg');
    });

    it('applies rounded-t-lg when open', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>Item</AccordionTrigger>
            <AccordionContent>Content</AccordionContent>
          </AccordionItem>
        </Accordion>
      );

      await user.click(screen.getByText('Item'));

      const trigger = container.querySelector("button[data-state='open']");
      expect(trigger).toHaveClass('data-[state=open]:rounded-t-lg');
    });
  });
});
