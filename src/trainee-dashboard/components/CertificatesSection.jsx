import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, Col, Icon, Row,
} from '@openedx/paragon';
import { Lock, WorkspacePremium } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';
import { formatDate } from '../utils';

const STATUS_MESSAGES = {
  earned: messages.earned,
  locked: messages.locked,
  revoked: messages.revoked,
};

const CertificatesSection = ({ certificates, programme }) => {
  const intl = useIntl();

  return (
    <section aria-labelledby="certificates-heading" className="trainee-dashboard__section">
      <div className="trainee-dashboard__section-heading">
        <h2 id="certificates-heading">{intl.formatMessage(messages.myCertificates)}</h2>
        <span>{intl.formatMessage(messages.earnedUpcoming)}</span>
      </div>
      {certificates.length === 0 ? <Alert variant="info">{intl.formatMessage(messages.noCertificates)}</Alert> : (
        <Row>
          {certificates.map(certificate => (
            <Col xs={12} md={6} xl={4} key={certificate.id} className="mb-3">
              <Card className={`trainee-dashboard__certificate h-100${certificate.status === 'earned' ? ' trainee-dashboard__certificate--earned' : ''}`}>
                <Card.Section>
                  <span className="trainee-dashboard__certificate-icon" aria-hidden="true">
                    <Icon src={certificate.status === 'earned' ? WorkspacePremium : Lock} />
                  </span>
                  <h3>{certificate.title}</h3>
                  <p>{programme.name}</p>
                  {certificate.certificate_number && (
                    <div className="trainee-dashboard__certificate-meta">
                      <span>{certificate.certificate_number}</span>
                      {certificate.issued_at && (
                        <span>{intl.formatMessage(messages.issued, {
                          date: formatDate(intl, certificate.issued_at),
                        })}
                        </span>
                      )}
                    </div>
                  )}
                  {certificate.eligibility_message && (
                    <p className="trainee-dashboard__certificate-requirement">{certificate.eligibility_message}</p>
                  )}
                  <div className="trainee-dashboard__certificate-action">
                    <Badge variant={certificate.status === 'earned' ? 'success' : 'light'}>
                      {intl.formatMessage(STATUS_MESSAGES[certificate.status])}
                    </Badge>
                    {certificate.can_download && (
                      <Button
                        as={Link}
                        to={`/${certificate.programme_key}/certificate`}
                        size="sm"
                      >
                        {intl.formatMessage(messages.viewCertificate)}
                      </Button>
                    )}
                  </div>
                </Card.Section>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </section>
  );
};

CertificatesSection.propTypes = {
  certificates: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    programme_key: PropTypes.string.isRequired,
    certificate_number: PropTypes.string,
    status: PropTypes.oneOf(['earned', 'locked', 'revoked']).isRequired,
    issued_at: PropTypes.string,
    can_download: PropTypes.bool.isRequired,
    eligibility_message: PropTypes.string,
  })).isRequired,
  programme: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired,
};

export default CertificatesSection;
