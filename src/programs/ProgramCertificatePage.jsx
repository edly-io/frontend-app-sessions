import React from 'react';
import { useParams } from 'react-router-dom';
import { Spinner } from '@openedx/paragon';
import { CertificateHtmlView, PrintCertificateButton } from '@edly-io/frontend-component-fbr';
import { useMyCertificate } from '../app/hooks';
import './certificate.scss';

const ProgramCertificatePage = () => {
  const { programId } = useParams();
  const {
    certificate, loading, notFound, error,
  } = useMyCertificate(programId);

  if (loading) {
    return (
      <div className="trainee-cert-page trainee-cert-page--centered">
        <Spinner animation="border" screenReaderText="Loading certificate" />
      </div>
    );
  }

  if (notFound || !certificate) {
    return (
      <div className="trainee-cert-page">
        <div className="trainee-cert-empty">
          <h2 className="trainee-cert-empty__title">No certificate yet</h2>
          <p className="trainee-cert-empty__text">
            {error || 'A certificate has not been issued for this program yet.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="trainee-cert-page">
      <div className="trainee-cert-toolbar">
        <PrintCertificateButton
          html={certificate.html}
          traineeName={certificate.traineeName}
          programName={certificate.programName}
        />
      </div>
      <div className="trainee-cert-print">
        <CertificateHtmlView html={certificate.html} />
      </div>
    </div>
  );
};

export default ProgramCertificatePage;
