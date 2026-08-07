import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StarRating } from './star-rating';

describe('StarRating', () => {
  it('renders five radio buttons when editable', () => {
    render(<StarRating value={0} onChange={jest.fn()} />);

    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('names each star for screen readers', () => {
    render(<StarRating value={0} onChange={jest.fn()} />);

    expect(screen.getByRole('radio', { name: '1 star' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '4 stars' })).toBeInTheDocument();
  });

  it('marks the current value as checked', () => {
    render(<StarRating value={3} onChange={jest.fn()} />);

    expect(screen.getByRole('radio', { name: '3 stars' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '2 stars' })).not.toBeChecked();
  });

  it('reports the picked rating', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<StarRating value={0} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: '4 stars' }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('groups the radios under one accessible legend', () => {
    render(<StarRating value={0} onChange={jest.fn()} />);

    expect(screen.getByRole('group', { name: /Your rating/ })).toBeInTheDocument();
  });

  it('exposes no form controls in read-only mode', () => {
    render(<StarRating value={4} readOnly />);

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('announces the score in read-only mode', () => {
    render(<StarRating value={4} readOnly />);

    expect(screen.getByText('4 out of 5 stars')).toBeInTheDocument();
  });
});
