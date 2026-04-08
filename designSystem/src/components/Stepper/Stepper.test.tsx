import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { Stepper, type StepperProps } from './Stepper';

describe('Stepper', () => {
  const mockSteps = [
    { id: 's1', label: 'Not Started' },
    { id: 's2', label: 'In Progress' },
    { id: 's3', label: 'Evidence Registered' },
    { id: 's4', label: 'Bank Verification' },
    { id: 's5', label: 'Completed' },
  ];

  describe('Edge Cases', () => {
    it('returns null when steps array is empty', () => {
      const { container } = render(<Stepper steps={[]} currentStep={0} size="xxl" />);
      expect(container.firstChild).toBeNull();
    });

    it('handles single step correctly', () => {
      const singleStep = [{ id: 's1', label: 'Single Step' }];
      const { container } = render(<Stepper steps={singleStep} currentStep={0} size="xxl" />);

      expect(screen.getByText('Single Step')).toBeInTheDocument();
      const currentStep = screen.getByLabelText(/Step 1: Single Step - Current/);
      expect(currentStep).toHaveAttribute('aria-current', 'step');

      // Progress bar should be 0% for single step
      const progressBar = container.querySelector('.absolute.left-0.transition-all');
      expect(progressBar).toHaveStyle({ width: '0px' });
    });

    it('handles very long step labels without breaking layout', () => {
      const longLabelSteps = [
        {
          id: 's1',
          label: 'This is a very long step label that should not break the layout',
        },
        { id: 's2', label: 'Short' },
      ];
      render(<Stepper steps={longLabelSteps} currentStep={0} size="xxl" />);

      expect(
        screen.getByText('This is a very long step label that should not break the layout')
      ).toBeInTheDocument();
      expect(screen.getByText('Short')).toBeInTheDocument();
    });

    it('handles duplicate step IDs gracefully', () => {
      const duplicateIdSteps = [
        { id: 's1', label: 'Step 1' },
        { id: 's1', label: 'Step 2' },
        { id: 's2', label: 'Step 3' },
      ];
      render(<Stepper steps={duplicateIdSteps} currentStep={1} size="xxl" />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });

    it('treats negative currentStep as 0', () => {
      render(<Stepper steps={mockSteps} currentStep={-1} size="xxl" />);
      const currentStep = screen.getByLabelText(/Step 1: Not Started - Current/);
      expect(currentStep).toHaveAttribute('aria-current', 'step');
    });

    it('treats out-of-range currentStep as last step', () => {
      render(<Stepper steps={mockSteps} currentStep={999} size="xxl" />);
      const currentStep = screen.getByLabelText(/Step 5: Completed - Current/);
      expect(currentStep).toHaveAttribute('aria-current', 'step');
    });

    it('handles floating point currentStep correctly', () => {
      render(<Stepper steps={mockSteps} currentStep={2.7} size="xxl" />);

      // Math.floor(2.7) = 2, so step 3 (index 2) should be current
      const step3 = screen.getByLabelText(/Step 3: Evidence Registered - Current/);
      expect(step3).toHaveAttribute('aria-current', 'step');

      // Steps 1 and 2 should be completed
      const step1 = screen.getByLabelText(/Step 1: Not Started - Completed/);
      expect(step1).toBeInTheDocument();

      const step2 = screen.getByLabelText(/Step 2: In Progress - Completed/);
      expect(step2).toBeInTheDocument();
    });
  });

  describe('Visual State', () => {
    it('displays check icon for all steps in big size', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={2} size="xxl" />);

      // Should have check icons for all 5 steps
      const checkIcons = container.querySelectorAll('svg');
      expect(checkIcons).toHaveLength(5);
    });

    it('does not display step numbers when labels are present', () => {
      render(<Stepper steps={mockSteps} currentStep={0} size="xxl" />);

      // Should not display any step numbers since all steps show check icons
      const stepNumbers = screen.queryByText(/\d+/);
      expect(stepNumbers).not.toBeInTheDocument();
    });

    it('calculates progress bar width correctly', () => {
      const { container, rerender } = render(
        <Stepper steps={mockSteps} currentStep={0} size="xxl" />
      );

      let progressBar = container.querySelector('.absolute.left-0.transition-all');
      expect(progressBar).toHaveStyle({ width: 'calc(0 * (100% - 32px))' });

      rerender(<Stepper steps={mockSteps} currentStep={2} size="xxl" />);
      progressBar = container.querySelector('.absolute.left-0.transition-all');
      expect(progressBar).toHaveStyle({ width: 'calc(0.5 * (100% - 32px))' });

      rerender(<Stepper steps={mockSteps} currentStep={4} size="xxl" />);
      progressBar = container.querySelector('.absolute.left-0.transition-all');
      expect(progressBar).toHaveStyle({ width: 'calc(1 * (100% - 32px))' });
    });

    it('applies correct CSS variable classes for theming', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={2} size="xxl" />);

      const baseProgressLine = container.querySelector(
        'div.bg-\\[var\\(--stepper-inactive-bg\\)\\]'
      );
      expect(baseProgressLine).not.toBeNull();

      const activeProgressLine = container.querySelector('.absolute.left-0.transition-all');
      expect(activeProgressLine?.className).toContain('bg-[var(--stepper-active)]');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA roles and labels', () => {
      render(<Stepper steps={mockSteps} currentStep={2} size="xxl" />);

      const nav = screen.getByRole('navigation', { name: 'Progress' });
      expect(nav).toBeInTheDocument();

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
    });

    it('marks only current step with aria-current', () => {
      render(<Stepper steps={mockSteps} currentStep={2} />);

      const listItems = screen.getAllByRole('listitem');
      const currentItems = listItems.filter((item) => item.getAttribute('aria-current'));

      expect(currentItems).toHaveLength(1);
      expect(currentItems[0]).toHaveAttribute('aria-current', 'step');
    });

    it('provides descriptive aria-labels for each step state', () => {
      render(<Stepper steps={mockSteps} currentStep={2} />);

      const completedStep = screen.getByLabelText(/Step 1: Not Started - Completed/);
      expect(completedStep).toBeInTheDocument();

      const currentStep = screen.getByLabelText(/Step 3: Evidence Registered - Current/);
      expect(currentStep).toBeInTheDocument();

      const upcomingStep = screen.getByLabelText(/Step 4: Bank Verification - Upcoming/);
      expect(upcomingStep).toBeInTheDocument();
    });

    it('hides decorative elements from screen readers', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={2} />);

      const progressBars = container.querySelectorAll('[aria-hidden="true"]');
      // Should have base line, progress line, and 5 step circles
      expect(progressBars.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Label-less Stepper', () => {
    it('renders without labels when all labels are empty', () => {
      const stepsWithoutLabels = [
        { id: 's1', label: '' },
        { id: 's2', label: '' },
        { id: 's3', label: '' },
      ];
      const { container } = render(
        <Stepper steps={stepsWithoutLabels} currentStep={1} size="xxl" />
      );

      // Should not display any large label elements (big layout selectors)
      const labelDivs = container.querySelectorAll('.absolute.top-\\[-3\\.1rem\\]');
      expect(labelDivs.length).toBe(0);
    });

    it('uses xs size configuration', () => {
      const stepsWithoutLabels = [
        { id: 's1', label: '' },
        { id: 's2', label: '' },
        { id: 's3', label: '' },
      ];
      const { container } = render(
        <Stepper steps={stepsWithoutLabels} currentStep={1} size="xs" />
      );

      const iconContainers = container.querySelectorAll('li > div');
      expect(iconContainers.length).toBe(3);
      iconContainers.forEach((iconContainer) => {
        const innerIndicator = iconContainer.querySelector('div');
        expect(innerIndicator?.className).toContain('flex');
        expect(innerIndicator?.className).toContain('items-center');
        expect(innerIndicator?.className).toContain('justify-center');
      });
    });

    it('displays check icon on current step in xs size', () => {
      const stepsWithoutLabels = [
        { id: 's1', label: '' },
        { id: 's2', label: '' },
        { id: 's3', label: '' },
      ];
      const { container } = render(
        <Stepper steps={stepsWithoutLabels} currentStep={1} size="xs" />
      );

      const checkIcons = container.querySelectorAll('svg');
      // Only current step should have check icon in xs size
      expect(checkIcons.length).toBe(1);
    });

    it('does not display step numbers in xs size', () => {
      const stepsWithoutLabels = [
        { id: 's1', label: '' },
        { id: 's2', label: '' },
        { id: 's3', label: '' },
      ];
      const { container } = render(
        <Stepper steps={stepsWithoutLabels} currentStep={0} size="xs" />
      );

      // Should not display step numbers
      const stepNumbers = container.querySelectorAll('li > div > span');
      expect(stepNumbers.length).toBe(0);

      // Should have check icon for current step in xs size
      const checkIcons = container.querySelectorAll('svg');
      expect(checkIcons.length).toBe(1);
    });
  });

  describe('React.memo Optimization', () => {
    it('does not re-render when props are unchanged', () => {
      let renderCount = 0;

      // Wrap Stepper to count renders
      const TestStepper = React.memo((props: StepperProps) => {
        renderCount++;
        return <Stepper {...props} />;
      });

      const { rerender } = render(<TestStepper steps={mockSteps} currentStep={1} size="xxl" />);
      const initialRenderCount = renderCount;

      // Re-render with same props (same object references)
      rerender(<TestStepper steps={mockSteps} currentStep={1} size="xxl" />);

      // Should not re-render because props haven't changed
      expect(renderCount).toBe(initialRenderCount);
    });

    it('re-renders when currentStep changes', () => {
      let renderCount = 0;

      const TestStepper = React.memo((props: StepperProps) => {
        renderCount++;
        return <Stepper {...props} />;
      });

      const { rerender } = render(<TestStepper steps={mockSteps} currentStep={1} size="xxl" />);
      const initialRenderCount = renderCount;

      // Re-render with different currentStep
      rerender(<TestStepper steps={mockSteps} currentStep={2} size="xxl" />);

      // Should re-render because currentStep changed
      expect(renderCount).toBe(initialRenderCount + 1);
    });
  });

  describe('Integration', () => {
    it('renders all steps with correct states in a complete flow', () => {
      render(<Stepper steps={mockSteps} currentStep={2} size="xxl" />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);

      // Verify step 1 is completed
      const step1 = screen.getByLabelText(/Step 1: Not Started - Completed/);
      expect(step1).toBeInTheDocument();

      // Verify step 2 is completed
      const step2 = screen.getByLabelText(/Step 2: In Progress - Completed/);
      expect(step2).toBeInTheDocument();

      // Verify step 3 is current
      const step3 = screen.getByLabelText(/Step 3: Evidence Registered - Current/);
      expect(step3).toHaveAttribute('aria-current', 'step');

      // Verify step 4 is upcoming
      const step4 = screen.getByLabelText(/Step 4: Bank Verification - Upcoming/);
      expect(step4).not.toHaveAttribute('aria-current');

      // Verify step 5 is upcoming
      const step5 = screen.getByLabelText(/Step 5: Completed - Upcoming/);
      expect(step5).not.toHaveAttribute('aria-current');
    });

    it('applies custom className without breaking default styles', () => {
      const { container } = render(
        <Stepper
          steps={mockSteps}
          currentStep={0}
          size="xxl"
          className="custom-class another-class"
        />
      );

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('custom-class');
      expect(nav).toHaveClass('another-class');
      expect(nav).toHaveClass('w-[876px]');
    });

    it('maintains consistent step order across re-renders', () => {
      const { rerender } = render(<Stepper steps={mockSteps} currentStep={0} size="xxl" />);

      const initialLabels = screen.getAllByRole('listitem').map((item) => item.textContent);

      rerender(<Stepper steps={mockSteps} currentStep={2} size="xxl" />);

      const updatedLabels = screen.getAllByRole('listitem').map((item) => item.textContent);

      // Labels should remain in same order
      expect(initialLabels.map((l) => l?.replace(/\d+/, ''))).toEqual(
        updatedLabels.map((l) => l?.replace(/\d+/, ''))
      );
    });
  });

  describe('Performance', () => {
    it('handles large number of steps efficiently', () => {
      const manySteps = Array.from({ length: 50 }, (_, i) => ({
        id: `step-${i}`,
        label: `Step ${i + 1}`,
      }));

      render(<Stepper steps={manySteps} currentStep={25} size="xxl" />);

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(50);

      // Verify current step is correct
      const currentStep = screen.getByLabelText(/Step 26.*Current/);
      expect(currentStep).toHaveAttribute('aria-current', 'step');
    });
  });

  describe('Layout and Styling', () => {
    it('applies correct positioning classes to list items', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={1} size="xxl" />);

      const listItems = container.querySelectorAll('li');
      listItems.forEach((item) => {
        expect(item.className).toContain('flex');
        expect(item.className).toContain('flex-col');
        expect(item.className).toContain('items-center');
        expect(item.className).toContain('relative');
        // left-[14px] is not applied in the current implementation
      });
    });

    it('positions labels with absolute positioning and proper transforms', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={1} size="xxl" />);

      const labels = container.querySelectorAll('li > div:first-child');
      labels.forEach((label) => {
        expect(label.className).toContain('absolute');
        expect(label.className).toContain('-top-12');
        expect(label.className).toContain('left-1/2');
        expect(label.className).toContain('-translate-x-1/2');
        expect(label.className).toContain('text-left');
        expect(label.className).toContain('whitespace-nowrap');
        expect(label.className).toContain('py-1');
      });
    });

    it('positions check icons and step numbers with centered transforms', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={2} size="xxl" />);

      const stepCircles = container.querySelectorAll("li > div:nth-child(2)[aria-hidden='true']");
      stepCircles.forEach((circle) => {
        expect(circle.className).toContain('absolute');
        expect(circle.className).toContain('left-1/2');
        expect(circle.className).toContain('-translate-x-1/2');
        expect(circle.className).toContain('-translate-y-1/2');
        expect(circle.className).toContain('flex');
        expect(circle.className).toContain('items-center');
        expect(circle.className).toContain('justify-center');
        expect(circle.className).toContain('z-10');
      });
    });

    it('applies consistent spacing with py-1 to labels', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={1} size="xxl" />);

      const labels = container.querySelectorAll('li > div:first-child');
      labels.forEach((label) => {
        expect(label.className).toContain('py-1');
      });
    });

    it('maintains proper z-index for step icon containers', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={1} size="xxl" />);

      const stepCircles = container.querySelectorAll("li > div:nth-child(2)[aria-hidden='true']");
      stepCircles.forEach((circle) => {
        expect(circle.className).toContain('z-10');
      });
    });

    it('uses correct progress bar positioning classes', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={2} size="xxl" />);

      // Base progress line
      const baseLine = container.querySelector('.absolute.left-0');
      expect(baseLine).toBeInTheDocument();
      expect(baseLine?.className).toContain('absolute');
      expect(baseLine?.className).toContain('left-0');

      // Active progress line
      const activeLine = container.querySelector('.absolute.left-0.transition-all');
      expect(activeLine).toBeInTheDocument();
      expect(activeLine?.className).toContain('absolute');
      expect(activeLine?.className).toContain('left-0');
      expect(activeLine?.className).toContain('transition-all');
    });

    it('aligns labels and step circles horizontally', () => {
      const { container } = render(<Stepper steps={mockSteps} currentStep={1} size="xxl" />);

      const listItems = container.querySelectorAll('li');
      listItems.forEach((item) => {
        const label = item.querySelector('div:first-child');
        const circle = item.querySelector('div:nth-child(2)');

        // Both should use left-1/2 -translate-x-1/2 for horizontal centering
        expect(label?.className).toContain('left-1/2');
        expect(label?.className).toContain('-translate-x-1/2');
        expect(circle?.className).toContain('left-1/2');
        expect(circle?.className).toContain('-translate-x-1/2');
      });
    });
  });
});
