import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CollapsiblePanel } from './collapsible-panel';

const setup = (open: boolean, onToggle = jest.fn()) =>
  render(
    <CollapsiblePanel
      id="panel"
      open={open}
      onToggle={onToggle}
      openLabel="Add movie"
      title="All titles"
    >
      <input aria-label="Inside" />
    </CollapsiblePanel>,
  );

describe('CollapsiblePanel', () => {
  it('starts with the content hidden behind the trigger', () => {
    setup(false);

    expect(screen.getByRole('button', { name: /Add movie/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Inside')).not.toBeInTheDocument();
  });

  it('keeps the collapsed content out of the DOM, not just invisible', () => {
    setup(false);

    // Unmounted, so its fields cannot be reached by Tab and reset on reopen.
    expect(screen.queryByLabelText('Inside')).not.toBeInTheDocument();
  });

  it('reveals the content when open', () => {
    setup(true);

    expect(screen.getByLabelText('Inside')).toBeInTheDocument();
  });

  it('announces its state to assistive tech', async () => {
    const { rerender } = setup(false);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'panel');

    rerender(
      <CollapsiblePanel id="panel" open onToggle={jest.fn()} openLabel="Add movie" title="All titles">
        <input aria-label="Inside" />
      </CollapsiblePanel>,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    await Promise.resolve();
  });

  it('switches the label to Cancel when open', () => {
    setup(true);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('reports a toggle', async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    setup(false, onToggle);

    await user.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('always shows the section title', () => {
    setup(false);

    expect(screen.getByRole('heading', { name: 'All titles' })).toBeInTheDocument();
  });
});
