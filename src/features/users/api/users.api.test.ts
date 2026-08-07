/**
 * @jest-environment node
 */
import { apiClient } from '@/lib/api';
import { buildAdmin, buildUser } from '@/testing/factories/auth.factory';
import { createUser, listUsers, updateUserRole, updateUserStatus } from './users.api';

describe('users.api', () => {
  let get: jest.SpyInstance;
  let post: jest.SpyInstance;

  beforeEach(() => {
    get = jest.spyOn(apiClient, 'get');
    post = jest.spyOn(apiClient, 'post');
  });

  it('lists users with no filters', async () => {
    const page = { items: [buildUser()], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } };
    get.mockResolvedValue(page);

    await expect(listUsers()).resolves.toBe(page);
    expect(get).toHaveBeenCalledWith('/users', expect.objectContaining({ query: {} }));
  });

  it('forwards role and status filters', async () => {
    get.mockResolvedValue({ items: [], meta: {} });

    await listUsers({ role: 'ADMIN', isActive: true, pageSize: 50 });

    expect(get).toHaveBeenCalledWith(
      '/users',
      expect.objectContaining({ query: { role: 'ADMIN', isActive: true, pageSize: 50 } }),
    );
  });

  it('updates the role at its dedicated sub-resource', async () => {
    const admin = buildAdmin();
    post.mockResolvedValue(admin);

    await expect(updateUserRole(admin.id, 'ADMIN')).resolves.toBe(admin);
    expect(post).toHaveBeenCalledWith(`/users/${admin.id}/role`, { role: 'ADMIN' });
  });

  it('updates the active flag at its own sub-resource', async () => {
    const user = buildUser();
    post.mockResolvedValue({ ...user, isActive: false });

    await updateUserStatus(user.id, false);

    expect(post).toHaveBeenCalledWith(`/users/${user.id}/status`, { isActive: false });
  });

  it('creates a user with the chosen role', async () => {
    const created = buildUser('PROVIDER');
    post.mockResolvedValue(created);
    const payload = {
      email: 'grace@test.io',
      password: 'Str0ng!Passw0rd',
      firstName: 'Grace',
      lastName: 'Hopper',
      role: 'PROVIDER' as const,
    };

    await expect(createUser(payload)).resolves.toBe(created);
    expect(post).toHaveBeenCalledWith('/users', payload);
  });

  it('url-encodes the id', async () => {
    post.mockResolvedValue(buildUser());

    await updateUserRole('a b/c', 'USER');

    expect(post).toHaveBeenCalledWith('/users/a%20b%2Fc/role', { role: 'USER' });
  });
});
