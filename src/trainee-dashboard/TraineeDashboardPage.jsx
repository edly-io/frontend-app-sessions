import React from 'react';
import { Col, Container, Row } from '@openedx/paragon';
import { FooterSlot } from '@edx/frontend-component-footer';
import HeaderSlot from '../plugin-slots/HeaderSlot';
import AttendanceCard from './components/AttendanceCard';
import CertificatesSection from './components/CertificatesSection';
import CoursesSection from './components/CoursesSection';
import DashboardHero from './components/DashboardHero';
import DashboardStats from './components/DashboardStats';
import FeedbackCard from './components/FeedbackCard';
import HolidaysCard from './components/HolidaysCard';
import ProgressCard from './components/ProgressCard';
import UpcomingSessionsCard from './components/UpcomingSessionsCard';
import './trainee-dashboard.scss';

const TraineeDashboardPage = () => (
  <>
    <HeaderSlot />
    <main id="main-content" className="trainee-dashboard">
      <Container size="xl">
        <DashboardHero />
        <DashboardStats />
        <UpcomingSessionsCard />
        <CoursesSection />
        <ProgressCard />
        <Row className="trainee-dashboard__lower-grid">
          <Col xs={12} lg={7} className="mb-3"><AttendanceCard /></Col>
          <Col xs={12} lg={5}>
            <div className="trainee-dashboard__side-column">
              <FeedbackCard />
              <HolidaysCard />
            </div>
          </Col>
        </Row>
        <CertificatesSection />
      </Container>
    </main>
    <FooterSlot />
  </>
);

export default TraineeDashboardPage;
