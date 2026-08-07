import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PaginationMeta } from '@/types/api';
import { Pagination } from './pagination';

const meta = (overrides: Partial<PaginationMeta> = {}): PaginationMeta => ({
  page: 1,
  pageSize: 20,
  totalItems: 137,
  totalPages: 7,
  hasNextPage: true,
  hasPreviousPage: false,
  ...overrides,
});

describe('Pagination', () => {
  it('states the range and the total, not just the page number', () => {
    render(<Pagination meta={meta({ page: 2, hasPreviousPage: true })} onPageChange={jest.fn()} itemLabel="title" />);

    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toHaveTextContent('Showing 21–40 of 137 titles');
    expect(nav).toHaveTextContent('Page 2 of 7');
  });

  it('does not run past the last page', () => {
    render(
      <Pagination
        meta={meta({ page: 7, totalItems: 137, hasNextPage: false, hasPreviousPage: true })}
        onPageChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('navigation')).toHaveTextContent('Showing 121–137 of 137');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('locks both ends on a single page', () => {
    render(
      <Pagination
        meta={meta({ totalItems: 3, totalPages: 1, hasNextPage: false })}
        onPageChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('reads sensibly with no results at all', () => {
    render(
      <Pagination
        meta={meta({ totalItems: 0, totalPages: 0, hasNextPage: false })}
        onPageChange={jest.fn()}
        itemLabel="title"
      />,
    );

    // Not "1–0 of 0", and not "Page 1 of 0" either.
    expect(screen.getByRole('navigation')).toHaveTextContent('Showing 0–0 of 0 titles');
    expect(screen.getByRole('navigation')).toHaveTextContent('Page 1 of 1');
  });

  it('singularises a lone result', () => {
    render(
      <Pagination
        meta={meta({ totalItems: 1, totalPages: 1, hasNextPage: false })}
        onPageChange={jest.fn()}
        itemLabel="account"
      />,
    );

    expect(screen.getByRole('navigation')).toHaveTextContent('of 1 account');
  });

  it('moves a page at a time', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();

    render(<Pagination meta={meta({ page: 3, hasPreviousPage: true })} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });

  it('locks the controls while a page is loading', () => {
    render(<Pagination meta={meta({ page: 2, hasPreviousPage: true })} onPageChange={jest.fn()} isBusy />);

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});
