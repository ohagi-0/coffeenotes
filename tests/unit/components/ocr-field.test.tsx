import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OcrField, isLowConfidence } from '@/components/logs/ocr-field';
import { LOW_CONFIDENCE_THRESHOLD } from '@/lib/schemas/bean-card';

afterEach(() => cleanup());

describe('OcrField', () => {
  it('しきい値は bean-card.ts の LOW_CONFIDENCE_THRESHOLD を使う', () => {
    expect(isLowConfidence(LOW_CONFIDENCE_THRESHOLD - 0.01)).toBe(true);
    expect(isLowConfidence(LOW_CONFIDENCE_THRESHOLD)).toBe(false);
    expect(isLowConfidence(null)).toBe(false);
    expect(isLowConfidence(undefined)).toBe(false);
  });

  it('信頼度が低いと「要確認」タグが出て、編集したら消える', () => {
    const { container } = render(
      <OcrField label="生産国" htmlFor="country" confidence={0.3}>
        <input id="country" defaultValue="Colombia" />
      </OcrField>,
    );
    expect(screen.getByText('要確認')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-low-confidence', 'true');

    fireEvent.change(screen.getByLabelText(/生産国/), { target: { value: 'Colombia ' } });
    expect(screen.queryByText('要確認')).toBeNull();
    expect(container.firstElementChild).not.toHaveAttribute('data-low-confidence');
  });

  it('信頼度が高い、または OCR 由来でない項目にはタグを出さない', () => {
    render(
      <>
        <OcrField label="豆名" confidence={0.95}>
          <input />
        </OcrField>
        <OcrField label="メモ">
          <textarea />
        </OcrField>
      </>,
    );
    expect(screen.queryByText('要確認')).toBeNull();
  });

  it('dirty を外から渡すと内部の検知より優先する', () => {
    const { rerender } = render(
      <OcrField label="標高" confidence={0.2} dirty={false}>
        <input />
      </OcrField>,
    );
    expect(screen.getByText('要確認')).toBeInTheDocument();
    rerender(
      <OcrField label="標高" confidence={0.2} dirty>
        <input />
      </OcrField>,
    );
    expect(screen.queryByText('要確認')).toBeNull();
  });

  it('error は role="alert" で出す', () => {
    render(
      <OcrField label="豆名" error="豆名を入力してください">
        <input />
      </OcrField>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('豆名を入力してください');
  });
});
