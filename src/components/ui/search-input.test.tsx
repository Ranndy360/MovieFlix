import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SearchInput } from './search-input';

describe('SearchInput', () => {
  it('has a real label, not just a placeholder', () => {
    render(<SearchInput id="s" label="Search titles" placeholder="Search by title…" value="" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Search titles')).toBeInTheDocument();
  });

  it('reports every keystroke', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<SearchInput id="s" label="Search titles" value="" onChange={onChange} />);
    await user.type(screen.getByLabelText('Search titles'), 'du');

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('offers a clear button only when there is something to clear', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    const { rerender } = render(<SearchInput id="s" label="Search titles" value="" onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();

    rerender(<SearchInput id="s" label="Search titles" value="dune" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onChange).toHaveBeenCalledWith('');
  });
});
