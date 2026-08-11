import React from 'react';
import {
  Badge, Button, Card, Col, Icon, Row,
} from '@openedx/paragon';
import { Download, Lock, WorkspacePremium } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import { certificates } from '../dashboardData';
import messages from '../messages';

const CertificatesSection = () => {
  const intl = useIntl();

  return (
    <section aria-labelledby="certificates-heading" className="trainee-dashboard__section">
      <div className="trainee-dashboard__section-heading">
        <h2 id="certificates-heading">{intl.formatMessage(messages.myCertificates)}</h2>
        <span>{intl.formatMessage(messages.earnedUpcoming)}</span>
      </div>
      <Row>
        {certificates.map(certificate => (
          <Col xs={12} md={6} xl={4} key={certificate.title} className="mb-3">
            <Card className={`trainee-dashboard__certificate h-100${certificate.earned ? ' trainee-dashboard__certificate--earned' : ''}`}>
              <Card.Section>
                <span className="trainee-dashboard__certificate-icon" aria-hidden="true">
                  <Icon src={certificate.earned ? WorkspacePremium : Lock} />
                </span>
                <h3>{certificate.title}</h3>
                <p>{certificate.programme}</p>
                {certificate.earned ? (
                  <>
                    <div className="trainee-dashboard__certificate-meta">
                      <span>{certificate.number}</span>
                      <span>{intl.formatMessage(messages.issued, { date: certificate.date })}</span>
                    </div>
                    <div className="trainee-dashboard__certificate-action">
                      <Badge variant="success">{intl.formatMessage(messages.earned)}</Badge>
                      <Button
                        size="sm"
                        iconBefore={Download}
                        disabled
                        title={intl.formatMessage(messages.downloadUnavailable)}
                      >
                        {intl.formatMessage(messages.downloadCertificate)}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="trainee-dashboard__certificate-requirement">{certificate.requirement}</p>
                    <Badge variant="light"><Icon src={Lock} />{intl.formatMessage(messages.notEarned)}</Badge>
                  </>
                )}
              </Card.Section>
            </Card>
          </Col>
        ))}
      </Row>
    </section>
  );
};

export default CertificatesSection;
