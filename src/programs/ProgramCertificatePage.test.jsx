import React from 'react';
import { render, screen } from '@testing-library/react';
import ProgramCertificatePage from './ProgramCertificatePage';

const mockUseMyCertificate = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: () => ({ programId: 'prog-key-1' }),
}));

jest.mock('../app/hooks', () => ({
  useMyCertificate: (...args) => mockUseMyCertificate(...args),
}));

// The shared @edly-io/frontend-component-fbr component is intentionally NOT
// mocked here: this suite renders the real CertificateHtmlView /
// PrintCertificateButton so that a prop-contract change in the library (e.g. a
// renamed `html` prop) fails these tests instead of silently passing against a
// stub. Its ESM build is transpiled for Jest via transformIgnorePatterns in
// jest.config.ts.

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

describe('<ProgramCertificatePage />', () => {
  it('shows a spinner while loading', () => {
    mockUseMyCertificate.mockReturnValue({ certificate: null, loading: true, notFound: false });
    render(<ProgramCertificatePage />);
    expect(screen.getByText('Loading certificate')).toBeInTheDocument();
  });

  it('renders the empty state when the learner has no certificate', () => {
    mockUseMyCertificate.mockReturnValue({ certificate: null, loading: false, notFound: true });
    render(<ProgramCertificatePage />);
    expect(screen.getByText('No certificate yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Print/i })).not.toBeInTheDocument();
  });

  it('injects the server-rendered certificate HTML and renders the shared print button', () => {
    const html = '<div class="fbr-cert"><h1>Marker Program</h1></div>';
    mockUseMyCertificate.mockReturnValue({
      certificate: {
        html,
        certificateNumber: 'FBR-CERT-ABC',
        issuedAt: '2026-06-18T00:00:00Z',
        status: 'active',
        programName: 'Marker Program',
        traineeName: 'Jawad Ali',
      },
      loading: false,
      notFound: false,
    });
    render(<ProgramCertificatePage />);
    // The real CertificateHtmlView injected the server HTML verbatim.
    expect(screen.getByText('Marker Program')).toBeInTheDocument();
    // The real PrintCertificateButton mounted with its default label.
    expect(screen.getByRole('button', { name: /Print \/ Save as PDF/i })).toBeInTheDocument();
  });
});
