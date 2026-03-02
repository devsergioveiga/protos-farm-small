import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ConfirmDeleteModal from './ConfirmDeleteModal';

describe('ConfirmDeleteModal', () => {
  const defaultProps = {
    isOpen: true,
    farmName: 'Fazenda Sol',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    isDeleting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the modal when open', () => {
    render(<ConfirmDeleteModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Excluir fazenda' })).toBeDefined();
    expect(screen.getByLabelText('Nome da fazenda *')).toBeDefined();
  });

  it('should not render when closed', () => {
    render(<ConfirmDeleteModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should have delete button disabled initially', () => {
    render(<ConfirmDeleteModal {...defaultProps} />);

    const deleteBtn = screen.getByRole('button', { name: 'Excluir fazenda' });
    expect(deleteBtn).toHaveProperty('disabled', true);
  });

  it('should enable delete button when farm name matches', async () => {
    const user = userEvent.setup();
    render(<ConfirmDeleteModal {...defaultProps} />);

    const input = screen.getByLabelText('Nome da fazenda *');
    await user.type(input, 'Fazenda Sol');

    const deleteBtn = screen.getByRole('button', { name: 'Excluir fazenda' });
    expect(deleteBtn).toHaveProperty('disabled', false);
  });

  it('should enable delete button case-insensitively', async () => {
    const user = userEvent.setup();
    render(<ConfirmDeleteModal {...defaultProps} />);

    const input = screen.getByLabelText('Nome da fazenda *');
    await user.type(input, 'fazenda sol');

    const deleteBtn = screen.getByRole('button', { name: 'Excluir fazenda' });
    expect(deleteBtn).toHaveProperty('disabled', false);
  });

  it('should call onConfirm when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmDeleteModal {...defaultProps} />);

    const input = screen.getByLabelText('Nome da fazenda *');
    await user.type(input, 'Fazenda Sol');

    await user.click(screen.getByRole('button', { name: 'Excluir fazenda' }));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmDeleteModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('should show loading state when deleting', () => {
    render(<ConfirmDeleteModal {...defaultProps} isDeleting={true} />);

    expect(screen.getByText('Excluindo...')).toBeDefined();
  });
});
