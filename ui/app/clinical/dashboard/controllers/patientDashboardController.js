'use strict';

angular.module('bahmni.clinical')
    .controller('PatientDashboardController', ['$scope', 'clinicalAppConfigService', 'clinicalDashboardConfig', 'printer',
        '$state', 'spinner', 'visitSummary', 'appService', '$stateParams', 'diseaseTemplateService', 'patientContext', '$location', '$filter',
        'messagingService', function ($scope, clinicalAppConfigService, clinicalDashboardConfig, printer,
                  $state, spinner, visitSummary, appService, $stateParams, diseaseTemplateService, patientContext,
                                      $location, $filter, messagingService) {
            $scope.patient = patientContext.patient;
            $scope.activeVisit = $scope.visitHistory.activeVisit;
            $scope.activeVisitData = {};
            $scope.obsIgnoreList = clinicalAppConfigService.getObsIgnoreList();
            $scope.clinicalDashboardConfig = clinicalDashboardConfig;
            $scope.visitSummary = visitSummary;
            $scope.enrollment = $stateParams.enrollment;
            $scope.isDashboardPrinting = false;
            var programConfig = appService.getAppDescriptor().getConfigValue("program") || {};

            $scope.stateChange = function () {
                return $state.current.name === 'patient.dashboard.show';
            };

            $scope.$on('$stateChangeStart', function (event, next, current) {
                var navigating = next.url.split("/")[1];
                var allConsultationBoards = clinicalAppConfigService.getAllConsultationBoards();
                var outOfConsultationBoard = true;
                allConsultationBoards.map(function (board) {
                    var consultationLink = board.url.split("/")[0];
                    if (navigating.includes(consultationLink)) {
                        outOfConsultationBoard = false;
                    }
                });

                if (next.url.includes("/dashboard") && $stateParams.patientUuid === current.patientUuid) {
                    outOfConsultationBoard = false;
                }

                if (outOfConsultationBoard && $state.dirtyConsultationForm) {
                    messagingService.showMessage('error', "{{'CONSULTATION_TAB_OBSERVATION_ERROR' | translate }}");
                    event.preventDefault();
                    spinner.hide(next.spinnerToken);
                }
            });

            var cleanUpListenerSwitchDashboard = $scope.$on("event:switchDashboard", function (event, dashboard) {
                $scope.init(dashboard);
            });

            var cleanUpListenerPrintDashboard = $scope.$on("event:printDashboard", function (event, tab) {
                var printScope = $scope.$new();
                printScope.isDashboardPrinting = true;
                printScope.tabBeingPrinted = tab || clinicalDashboardConfig.currentTab;
                var dashboardModel = Bahmni.Common.DisplayControl.Dashboard.create(printScope.tabBeingPrinted, $filter);
                spinner.forPromise(diseaseTemplateService.getLatestDiseaseTemplates(
                    $stateParams.patientUuid,
                    clinicalDashboardConfig.getDiseaseTemplateSections(printScope.tabBeingPrinted),
                    null,
                    null
                ).then(function (diseaseTemplate) {
                    printScope.diseaseTemplates = diseaseTemplate;
                    printScope.sectionGroups = dashboardModel.getSections(printScope.diseaseTemplates);
                    printer.printFromScope('dashboard/views/dashboardPrint.html', printScope);
                }));
            });

            $scope.$on("$destroy", function () {
                cleanUpListenerSwitchDashboard();
                cleanUpListenerPrintDashboard();
            });

            var addTabNameToParams = function (board) {
                $location.search('currentTab', board.translationKey).replace();
            };

            var getCurrentTab = function () {
                var currentTabKey = $location.search().currentTab;
                var currentTab = $state.current.dashboard;
                if (currentTabKey) {
                    currentTab = _.find(clinicalDashboardConfig.visibleTabs, function (tab) {
                        return tab.translationKey === currentTabKey;
                    });
                }
                return (currentTab != undefined ? currentTab : clinicalDashboardConfig.currentTab);
            };

            $scope.init = function (dashboard) {
                dashboard.startDate = null;
                dashboard.endDate = null;
                if (programConfig.showDetailsWithinDateRange) {
                    dashboard.startDate = $stateParams.dateEnrolled;
                    dashboard.endDate = $stateParams.dateCompleted;
                }
                $state.current.dashboard = dashboard;
                clinicalDashboardConfig.switchTab(dashboard);
                addTabNameToParams(dashboard);
                var dashboardModel = Bahmni.Common.DisplayControl.Dashboard.create(dashboard, $filter);
                diseaseTemplateService.getLatestDiseaseTemplates(
                    $stateParams.patientUuid, clinicalDashboardConfig.getDiseaseTemplateSections(), dashboard.startDate, dashboard.endDate).then(function (diseaseTemplate) {
                        $scope.diseaseTemplates = diseaseTemplate;
                        $scope.sectionGroups = dashboardModel.getSections($scope.diseaseTemplates);
                    });
                $scope.currentDashboardTemplateUrl = $state.current.views['dashboard-content'] ?
                    $state.current.views['dashboard-content'].templateUrl : $state.current.views['dashboard-content'];
            };

            $scope.init(getCurrentTab());
        }]);
