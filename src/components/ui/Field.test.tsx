import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Field } from './Field';

afterEach(cleanup);
it('associe le label, le conseil et l’erreur au champ', () => {
  render(<><p id="hint">Six chiffres</p><Field label="Code" name="code" error="Code incorrect" aria-describedby="hint" /></>);
  const field = screen.getByLabelText('Code');
  expect(field.getAttribute('aria-invalid')).toBe('true');
  const descriptions = field.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)!.textContent);
  expect(descriptions).toEqual(['Six chiffres', 'Code incorrect']);
});
it('ne marque pas un champ sans erreur comme invalide', () => {
  render(<Field id="phone" label="Téléphone" />);
  expect(screen.getByLabelText('Téléphone').hasAttribute('aria-invalid')).toBe(false);
});
