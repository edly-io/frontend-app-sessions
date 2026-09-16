import React from 'react';
import {
  Alert, Spinner, Tab, Tabs,
} from '@openedx/paragon';
import './dashboard.scss';
import DashboardShell from './DashboardShell';
import AdminDashboardView from '../admin-dashboard/AdminDashboardView';
import InstructorDashboardPage from '../instructor-dashboard/InstructorDashboardPage';
import TraineeDashboardPage from '../trainee-dashboard/TraineeDashboardPage';
import useMyFbrRoles from '../app/useMyFbrRoles';
import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';

const DashboardPage = () => {
  const { roles, isLoading: rolesLoading } = useMyFbrRoles();
  const { data: config, isLoading: configLoading, isError: configError } = useConfig();

  const isAdmin = config?.user_role === USER_ROLE.ADMIN;
  const isInstructor = roles.includes('instructor');
  const isTrainee = roles.includes('trainee');
  const isDualRole = isInstructor && isTrainee;

  if (rolesLoading || configLoading) {
    return (
      <DashboardShell className="user-dashboard">
        <div className="py-5 text-center">
          <Spinner animation="border" screenReaderText="Loading dashboard" />
        </div>
      </DashboardShell>
    );
  }

  if (configError) {
    return (
      <DashboardShell className="user-dashboard">
        <Alert variant="danger" className="m-4">
          <Alert.Heading>Could not load dashboard</Alert.Heading>
          <p>
            There was a problem loading your dashboard configuration.
            Please refresh the page or contact your administrator.
          </p>
        </Alert>
      </DashboardShell>
    );
  }

  if (isAdmin) {
    return (
      <DashboardShell className="user-dashboard">
        <AdminDashboardView />
      </DashboardShell>
    );
  }

  if (isDualRole) {
    return (
      <DashboardShell className="user-dashboard">
        <Tabs id="dashboard-role-tabs" defaultActiveKey="instructor" className="mb-4">
          <Tab eventKey="instructor" title="As Instructor">
            <InstructorDashboardPage asTab />
          </Tab>
          <Tab eventKey="trainee" title="As Trainee">
            <TraineeDashboardPage asTab />
          </Tab>
        </Tabs>
      </DashboardShell>
    );
  }

  if (isInstructor) {
    return (
      <DashboardShell className="user-dashboard">
        <InstructorDashboardPage asTab />
      </DashboardShell>
    );
  }

  if (isTrainee) {
    return (
      <DashboardShell className="user-dashboard">
        <TraineeDashboardPage asTab />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell className="user-dashboard">
      <Alert variant="info" className="m-4">
        <Alert.Heading>No role assigned</Alert.Heading>
        <p>
          Your account has been created but no FBR role has been assigned yet.
          Please contact your administrator to get access.
        </p>
      </Alert>
    </DashboardShell>
  );
};

export default DashboardPage;
