import { Router } from "express";
import { asyncHandler } from "../../lib/errors.js";
import {
  authenticate,
  requireEntitlement,
  requireModule,
  requireAnyPermission,
  requirePermission,
  requireTenant,
} from "../../middleware/auth.middleware.js";
import { auditTenantMutation } from "../../middleware/audit.middleware.js";
import {
  assignStaffToRoleController,
  createRoleController,
  createUserController,
  deleteRoleController,
  deleteUserController,
  getStaffRolesSetupController,
  getUserController,
  listPermissionsController,
  listRolesController,
  listUsersController,
  removeStaffFromRoleController,
  updateRoleController,
  updateUserController,
} from "../../modules/access/access.controller.js";
import {
  applyAcademicBulkUpdateController,
  assignSubjectController,
  bulkUpdateStudentSectionsController,
  createAcademicsTimetableEntryController,
  createClassController,
  createClassSectionController,
  createElectiveCategoryController,
  createSchoolScholarController,
  createSectionController,
  createSessionController,
  createSubjectController,
  createSubjectGroupController,
  deleteAcademicRecordController,
  deleteAcademicsTimetableEntryController,
  deleteElectiveCategoryController,
  deleteSchoolScholarController,
  deleteSessionController,
  deleteSubjectGroupController,
  getAcademicReportCatalogController,
  getAcademicSetupController,
  getAcademicsTimetableSetupController,
  getElectiveAssignmentBoardController,
  getPromoteBoardController,
  listSchoolScholarsController,
  listSessionsController,
  listSubjectGroupsController,
  promoteStudentsController,
  reorderClassesController,
  reorderSubjectsController,
  runAcademicReportController,
  saveStudentElectivesController,
  setCurrentSessionController,
  updateAcademicsTimetableEntryController,
  updateClassController,
  updateClassSectionController,
  updateElectiveCategoryController,
  updateSchoolScholarController,
  updateSectionController,
  updateSessionController,
  updateSubjectController,
  updateSubjectGroupController,
} from "../../modules/academics/academics.controller.js";
import {
  acceptOnlineAdmissionController,
  addEnrollmentController,
  bulkUploadStudentPhotosController,
  createStudentController,
  createStudentMasterController,
  deleteStudentMasterController,
  deleteStudentsController,
  detectSiblingsController,
  getStudentDetailController,
  getStudentSetupController,
  importStudentsController,
  linkSiblingsController,
  listOnlineAdmissionsController,
  listStudentsController,
  rejectOnlineAdmissionController,
  updateStudentController,
  getStudentExamsController,
  getStudentSubjectsController,
  getStudentTimelineController,
  getStudentPortalAccountsController,
  resetStudentPortalPasswordController,
  listAppDownloadStatusController,
  getPortalLoginReminderSettingsController,
  updatePortalLoginReminderSettingsController,
  sendPortalLoginRemindersController,
  listStudentDocumentFoldersController,
  listStudentDocumentsBrowserController,
  uploadStudentDocumentController,
  deleteStudentDocumentManagedController,
} from "../../modules/students/students.controller.js";
import { avatarUpload, documentUpload } from "../../lib/uploads.js";
import {
  createCampusNoticeController,
  deleteCampusNoticeController,
  listCampusNoticesController,
  updateCampusNoticeController,
} from "../../modules/portal/portal.controller.js";
import {
  createNotificationController,
  getUnreadCountController,
  listNotificationsController,
  markAllReadController,
  markReadController,
  sendFeeOverdueRemindersController,
  sendSmsController,
  subscribePushController,
  testPushController,
  unsubscribePushController,
} from "../../modules/notifications/notifications.controller.js";
import {
  getSchoolProfileController,
  getSettingsController,
  updateSchoolProfileController,
  updateSettingsController,
} from "../../modules/settings/settings.controller.js";
import {
  assignFeeMasterController,
  carryForwardPreviousDuesController,
  collectPaymentController,
  createFeeInvoiceController,
  createFeeDiscountController,
  createFeeGroupController,
  createFeeMasterController,
  createCustomFeeController,
  createFeeTypeController,
  createReceiptBookController,
  deleteFeeDiscountController,
  deleteFeeGroupController,
  deleteFeeMasterController,
  deleteFeeTypeController,
  deleteReceiptBookController,
  getFeeSettingsController,
  getFeeSetupController,
  updateFeeSettingsController,
  getFeeReminderStatsController,
  getFeeSummaryController,
  getFeeInvoiceController,
  getFeePaymentController,
  listFeeMasterAssignCandidatesController,
  listStudentFeesController,
  listFeeInvoicesController,
  reorderFeeMastersController,
  revertPaymentController,
  searchPaymentsController,
  setCustomFeeActiveController,
  setFeeInvoiceStatusController,
  updateAssignmentDiscountController,
  updateFeeDiscountController,
  updateFeeGroupController,
  updateFeeMasterController,
  runFeeRemindersController,
  sendStudentFeeReminderController,
  updateFeeReminderController,
  updateFeeTypeController,
  updateReceiptBookController,
} from "../../modules/fees/fees.controller.js";
import {
  confirmOnlineOrderController,
  createOnlineOrderController,
  getOnlineOrderController,
  getOnlinePaymentConfigController,
} from "../../modules/fees/online-payments.controller.js";
import {
  copyMultiFeeBookController,
  createMultiFeeBookController,
  deleteMultiFeeBookController,
  getMultiFeeBookSetupController,
  updateMultiFeeBookController,
} from "../../modules/fees/multi-fee-book.controller.js";
import {
  awardAttendancePointsController,
  createLeaveController,
  getAttendancePointsController,
  getAttendancePointScoresController,
  getAttendanceReportCatalogController,
  updateAttendancePointConfigController,
  getAttendanceReportController,
  getAttendanceSetupController,
  listLeavesController,
  markAttendanceController,
  reviewLeaveController,
  runAttendancePackReportController,
  scanAttendanceController,
} from "../../modules/attendance/attendance.controller.js";
import {
  addMarkComponentController,
  archiveExamController,
  assignExamStudentsController,
  createExamAspectController,
  createExamController,
  createExamGradeController,
  createExamGroupController,
  createExamLinkController,
  createExamScheduleController,
  deleteExamAspectController,
  deleteExamController,
  deleteExamGradeController,
  deleteExamGroupController,
  deleteExamLinkController,
  deleteExamScheduleController,
  deleteExamSubjectLinkController,
  deleteMarkComponentController,
  getExamResultsController,
  getExamGroupResultsController,
  getExamLinkResultsController,
  getExamSetupController,
  getScheduleRosterController,
  listExamLinksController,
  listExamStudentsController,
  listExamSubjectLinksController,
  publishExamController,
  unpublishExamController,
  reorderMarkComponentsController,
  saveAspectValuesController,
  saveExamMarksController,
  saveExamSubjectLinkController,
  updateExamAspectController,
  updateExamController,
  updateExamGradeController,
  updateExamGroupController,
  updateExamScheduleController,
  updateExamStudentPortalVisibilityController,
  updateMarkComponentController,
} from "../../modules/exams/exams.controller.js";
import {
  assignGradingScaleToClassesController,
  createGradingScaleController,
  createGradingScaleGradeController,
  deleteGradingScaleController,
  deleteGradingScaleGradeController,
  getGradingScaleSetupController,
  updateGradingScaleController,
  updateGradingScaleGradeController,
} from "../../modules/exams/grading-scale.controller.js";
import {
  addStaffAdjustmentController,
  addTeacherRatingController,
  applyOwnStaffLeaveController,
  applyStaffLeaveController,
  createDepartmentController,
  createDesignationController,
  createStaffLeaveTypeController,
  createStaffProfileController,
  generatePayrollController,
  getHrSetupController,
  getPayrollPayslipController,
  getStaffAttendanceReportController,
  getStaffDetailController,
  getStaffLeaveController,
  getTeacherRatingsSummaryController,
  listDisabledStaffController,
  markStaffAttendanceController,
  payPayrollController,
  revertPayrollController,
  createPayParameterController,
  deleteDepartmentController,
  deleteDesignationController,
  deletePayParameterController,
  deleteStaffAdjustmentController,
  deleteStaffLeaveTypeController,
  deleteStaffProfileController,
  reviewStaffLeaveController,
  updateDepartmentController,
  updateDesignationController,
  updatePayParameterController,
  updateStaffAdjustmentController,
  updateStaffLeaveTypeController,
  updateStaffProfileController,
  updateStaffStatusController,
} from "../../modules/hr/hr.controller.js";
import {
  createStaffWorkShiftController,
  deleteStaffHolidayController,
  deleteStaffWorkShiftController,
  getStaffAttendanceSettingsController,
  updateStaffAttendanceSettingsController,
  updateStaffWorkShiftController,
  upsertStaffHolidayController,
} from "../../modules/hr/staff-attendance-settings.controller.js";
import {
  createLeaveTypeSettingsController,
  deleteLeaveTypeSettingsController,
  getLeaveTypesSetupController,
  updateLeaveTypeSettingsController,
} from "../../modules/hr/leave-types-settings.controller.js";
import {
  createPayComponentController,
  deletePayComponentController,
  getPayrollSettingsSetupController,
  updatePayComponentController,
  updatePayrollSettingsController,
} from "../../modules/hr/payroll-settings.controller.js";
import {
  createDocumentTemplateController,
  deleteDocumentTemplateController,
  generateDocumentController,
  generateDocumentsBulkController,
  getGeneratedDocumentController,
  listDocumentTemplatesController,
  listGeneratedDocumentsController,
  updateDocumentTemplateController,
} from "../../modules/documents/documents.controller.js";
import {
  getReportHubController,
  runCoreReportController,
  runExtraReportController,
  runFeeReportController,
  runModuleReportController,
  runStudentReportController,
} from "../../modules/reports/reports.controller.js";
import {
  createTimetableEntryController,
  deleteTimetableEntryController,
  getFreePeriodReportController,
  getTimetableSetupController,
  updateTimetableEntryController,
} from "../../modules/timetable/timetable.controller.js";
import {
  createTimetablePeriodController,
  createTimetableTemplateController,
  deleteTimetablePeriodController,
  deleteTimetableTemplateController,
  getTimetablePeriodSetupController,
  updateTimetablePeriodController,
  updateTimetablePeriodSettingsController,
  updateTimetableTemplateController,
} from "../../modules/timetable/period-setup.controller.js";
import {
  createHomeworkController,
  evaluateHomeworkSubmissionController,
  getHomeworkController,
  getHomeworkNamedReportController,
  getHomeworkReportController,
  getHomeworkSetupController,
  getHomeworkSubmissionsController,
  submitHomeworkController,
  updateHomeworkController,
} from "../../modules/homework/homework.controller.js";
import {
  createHomeworkTypeController,
  createHomeworkWorkflowStatusController,
  deleteHomeworkTypeController,
  deleteHomeworkWorkflowStatusController,
  getHomeworkSettingsSetupController,
  updateHomeworkSettingsController,
  updateHomeworkTypeController,
  updateHomeworkWorkflowStatusController,
} from "../../modules/homework/homework-settings.controller.js";
import {
  createConfigurationBackupController,
  createCustomFieldController,
  createDocumentFolderController,
  createHolidayController,
  createPaymentMethodController,
  createStudentDocumentController,
  deleteCustomFieldController,
  deleteHolidayController,
  deletePaymentMethodController,
  deleteStudentDocumentController,
  getErpSetupController,
  listLanguagesController,
  restoreConfigurationBackupController,
  syncLanguagesController,
  updateCustomFieldController,
  updateIntegrationController,
  updatePaymentMethodController,
  upsertLanguageController,
  upsertModuleController,
  upsertProfileRightController,
  upsertShortcutController,
  upsertSystemFieldController,
} from "../../modules/erp/erp.controller.js";
import {
  deletePaymentMethodSetupController,
  getPaymentMethodsSetupController,
  togglePaymentMethodSetupController,
  upsertPaymentMethodSetupController,
} from "../../modules/erp/payment-methods.controller.js";
import {
  createSystemBackupController,
  deleteBackupScheduleController,
  deleteSystemBackupController,
  getBackupRestoreSetupController,
  restoreSystemBackupController,
  saveBackupSettingsController,
  upsertBackupScheduleController,
} from "../../modules/erp/backup-restore.controller.js";
import {
  createModuleSetupController,
  deleteModuleSetupController,
  getModulesSetupController,
  toggleModuleSetupController,
  upsertModuleSetupController,
} from "../../modules/erp/modules-settings.controller.js";
import {
  deleteLibraryMemberTypeController,
  deleteLibrarySettingsCategoryController,
  getLibrarySettingsSetupController,
  previewLibraryBarcodeController,
  saveLibrarySettingsController,
  upsertLibraryMemberTypeController,
  upsertLibrarySettingsCategoryController,
} from "../../modules/erp/library-settings.controller.js";
import {
  deleteTransportSettingsRouteController,
  deleteTransportVehicleController,
  getTransportSettingsSetupController,
  saveTransportSettingsController,
  upsertTransportSettingsRouteController,
  upsertTransportVehicleController,
} from "../../modules/erp/transport-settings.controller.js";
import {
  getSessionLoginPolicySetupController,
  saveSessionLoginPolicyController,
  terminateLoginSessionController,
  terminateOtherLoginSessionsController,
} from "../../modules/erp/session-login-policy.controller.js";
import {
  createCalendarHolidayController,
  deleteCalendarHolidayController,
  deleteHolidayGroupController,
  exportHolidaysCalendarController,
  getHolidaysCalendarSetupController,
  saveHolidaySettingsController,
  updateCalendarHolidayController,
  upsertHolidayGroupController,
} from "../../modules/erp/holidays-calendar.controller.js";
import {
  getTwoFactorSetupController,
  saveTwoFactorSettingsController,
} from "../../modules/erp/two-factor.controller.js";
import {
  deleteImportJobController,
  exportDataController,
  getDataImportExportSetupController,
  runDataExportController,
  runDataImportController,
} from "../../modules/erp/data-import-export.controller.js";
import {
  deleteQuestionBankDifficultyController,
  getQuestionBankSettingsController,
  updateQuestionBankSettingsController,
  upsertQuestionBankDifficultyController,
} from "../../modules/erp/question-bank-settings.controller.js";
import {
  getStudentAccessSettingsController,
  updateStudentAccessSettingsController,
} from "../../modules/erp/student-access-settings.controller.js";
import { getSystemFieldsSetupController } from "../../modules/erp/system-fields.controller.js";
import {
  getShortcutKeysSetupController,
  resetShortcutKeysController,
  saveShortcutKeysController,
} from "../../modules/erp/shortcut-keys.controller.js";
import {
  createStudentDocsFolderController,
  deleteStudentDocsFolderController,
  getStudentDocsFoldersSetupController,
  reorderStudentDocsFoldersController,
  restoreStudentDocsFolderController,
  updateStudentDocsFolderController,
} from "../../modules/erp/student-docs-folders.controller.js";
import {
  getThemeBrandingSetupController,
  saveThemeBrandingController,
} from "../../modules/erp/theme-branding.controller.js";
import {
  createWebsiteMediaController,
  createWebsitePageController,
  deleteWebsiteBannerController,
  deleteWebsiteMediaController,
  deleteWebsiteMenuController,
  deleteWebsiteMenuItemController,
  deleteWebsitePageController,
  getWebsiteCmsSetupController,
  saveWebsiteSiteSettingsController,
  updateWebsitePageController,
  upsertWebsiteBannerController,
  upsertWebsiteMenuController,
  upsertWebsiteMenuItemController,
} from "../../modules/erp/website-cms.controller.js";
import {
  cloneSmsTemplateController,
  deleteSmsTemplateController,
  getSmsGatewaySetupController,
  saveSmsGatewayController,
  testSmsGatewayController,
  upsertSmsTemplateController,
} from "../../modules/erp/sms-gateway.controller.js";
import {
  cloneEmailGatewayController,
  deleteEmailGatewayController,
  deleteEmailTemplateController,
  getEmailGatewaySetupController,
  testEmailGatewayController,
  upsertEmailGatewayController,
  upsertEmailTemplateController,
} from "../../modules/erp/email-gateway.controller.js";
import {
  deleteWhatsAppTemplateController,
  getWhatsAppGatewaySetupController,
  saveWhatsAppGatewayController,
  sendWhatsAppTestMessageController,
  testWhatsAppConnectionController,
  upsertWhatsAppTemplateController,
} from "../../modules/erp/whatsapp-gateway.controller.js";
import {
  deletePushTopicController,
  getPushGatewaySetupController,
  savePushGatewayController,
  testPushGatewayController,
  upsertPushTopicController,
} from "../../modules/erp/push-gateway.controller.js";
import {
  deleteNotificationTriggerController,
  getNotificationTriggersSetupController,
  testNotificationTriggerController,
  toggleNotificationTriggerController,
  upsertNotificationTriggerController,
} from "../../modules/erp/notification-triggers.controller.js";
import {
  deleteMessageNoticeTemplateController,
  getMessageNoticeTemplatesSetupController,
  toggleMessageNoticeTemplateController,
  upsertMessageNoticeTemplateController,
} from "../../modules/erp/message-notice-templates.controller.js";
import {
  assignHostelStudentController,
  createHostelBedController,
  createHostelBlockController,
  createHostelRoomController,
  deleteHostelBedController,
  deleteHostelBlockController,
  deleteHostelRoomController,
  listHostelBedsController,
  listHostelBlocksController,
  listHostelLogsController,
  listHostelRoomsController,
  listRoomStudentsController,
  updateHostelBlockController,
  updateHostelRoomController,
} from "../../modules/hostel/hostel.controller.js";
import {
  addInventoryStockController,
  createInventoryCategoryController,
  createInventoryItemController,
  deleteInventoryCategoryController,
  deleteInventoryItemController,
  inventorySummaryController,
  issueInventoryItemController,
  listInventoryCategoriesController,
  listInventoryItemsController,
  listInventoryMovementsController,
  returnInventoryItemController,
  updateInventoryCategoryController,
  updateInventoryItemController,
} from "../../modules/inventory/inventory.controller.js";
import {
  createOnlineExamController,
  createOnlineQuestionController,
  deleteOnlineExamController,
  deleteOnlineQuestionController,
  getOnlineExamController,
  gradeSubjectiveAnswerController,
  listExamRanksController,
  listOnlineAttemptsController,
  listOnlineExamsController,
  listOnlineQuestionsController,
  listPendingSubjectiveGradesController,
  onlineExamSummaryController,
  startOnlineAttemptController,
  submitOnlineAttemptController,
  updateOnlineExamController,
  updateOnlineQuestionController,
} from "../../modules/online-exam/online-exam.controller.js";
import {
  createLibraryBookController,
  createLibraryCategoryController,
  deleteLibraryBookController,
  deleteLibraryCategoryController,
  issueLibraryBookController,
  librarySummaryController,
  listLibraryBooksController,
  listLibraryCategoriesController,
  listLibraryLoansController,
  returnLibraryBookController,
  updateLibraryBookController,
  updateLibraryCategoryController,
} from "../../modules/library/library.controller.js";
import {
  assignTransportStudentController,
  createTransportRouteController,
  deleteTransportRouteController,
  listRouteStudentsController,
  listTransportLogsController,
  listTransportRoutesController,
  updateTransportRouteController,
} from "../../modules/transport/transport.controller.js";
import { questionBankRouter } from "../../modules/questionBank/questionBank.routes.js";
import { testSeriesRouter } from "../../modules/testSeries/testSeries.routes.js";
import { lessonPlanningRouter } from "../../modules/lessonPlanning/lessonPlanning.routes.js";
import { liveClassesRouter } from "../../modules/liveClasses/liveClasses.routes.js";
import { ncertContentRouter } from "../../modules/ncertContent/ncertContent.routes.js";
import { academicCalendarRouter } from "../../modules/academicCalendar/academicCalendar.routes.js";

const campusRouter = Router();
campusRouter.use(authenticate, requireTenant);
campusRouter.use(auditTenantMutation);
campusRouter.use("/students", requireModule("students"));
campusRouter.use("/notices", requireModule("notices"));
campusRouter.use("/erp", requireEntitlement("CMS"), requireModule("erp"));
campusRouter.use("/academics", requireModule("academics"));
campusRouter.use("/fees", requireEntitlement("CMS"), requireModule("fees"));
campusRouter.use("/attendance", requireModule("attendance"));
campusRouter.use("/exams", requireModule("examinations"));
campusRouter.use("/hr", requireEntitlement("CMS"), requireModule("hr"));
campusRouter.use("/documents", requireEntitlement("CMS"), requireModule("documents"));
campusRouter.use("/reports", requireModule("reports"));
campusRouter.use("/timetable", requireEntitlement("LMS"), requireModule("timetable"));
// Homework is reachable from the CMS sidebar (under Examination), so it is
// gated by module toggle + permissions only, like exams.
campusRouter.use("/homework", requireModule("homework"));
campusRouter.use("/homework-reports", requireModule("homework"));
campusRouter.use("/transport", requireEntitlement("CMS"), requireModule("transport"));
campusRouter.use("/hostel", requireEntitlement("CMS"), requireModule("hostel"));
campusRouter.use("/library", requireEntitlement("CMS"), requireModule("library"));
campusRouter.use("/inventory", requireEntitlement("CMS"), requireModule("inventory"));
campusRouter.use("/online-exams", requireEntitlement("CMS"), requireModule("onlineExam"));
campusRouter.use(
  "/question-bank",
  requireEntitlement("LMS"),
  requireModule("questionBank"),
  requireAnyPermission("question_bank.view", "online_exam.view", "online_exam.manage"),
  questionBankRouter,
);
campusRouter.use(
  "/test-series",
  requireEntitlement("LMS"),
  requireModule("testSeries"),
  requireAnyPermission(
    "test_series.view",
    "test_series.manage",
    "online_exam.view",
    "online_exam.manage",
  ),
  testSeriesRouter,
);
campusRouter.use(
  "/lesson-planning",
  requireEntitlement("LMS"),
  requireModule("lessonPlanning"),
  requireAnyPermission("lesson_planning.view", "lesson_planning.manage", "academics.view"),
  lessonPlanningRouter,
);
campusRouter.use(
  "/live-classes",
  requireEntitlement("LMS"),
  requireModule("liveClasses"),
  requireAnyPermission("live_classes.view", "live_classes.manage", "timetable.view"),
  liveClassesRouter,
);
campusRouter.use(
  "/ncert-content",
  requireEntitlement("LMS"),
  requireModule("ncertLibrary"),
  requireAnyPermission("ncert.view", "ncert.manage", "academics.view"),
  ncertContentRouter,
);
campusRouter.use(
  "/academic-calendar",
  requireEntitlement("LMS"),
  requireModule("academicCalendar"),
  requireAnyPermission("academic_calendar.view", "academic_calendar.manage"),
  academicCalendarRouter,
);

campusRouter.get(
  "/settings",
  requireAnyPermission("settings.view", "erp.view"),
  asyncHandler(getSettingsController),
);
campusRouter.put(
  "/settings",
  requireAnyPermission("settings.manage", "erp.manage"),
  asyncHandler(updateSettingsController),
);
campusRouter.get(
  "/settings/school-profile",
  requireAnyPermission("erp.view", "settings.view"),
  asyncHandler(getSchoolProfileController),
);
campusRouter.put(
  "/settings/school-profile",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(updateSchoolProfileController),
);

campusRouter.get(
  "/notices",
  requirePermission("settings.view"),
  asyncHandler(listCampusNoticesController),
);
campusRouter.post(
  "/notices",
  requirePermission("settings.manage"),
  asyncHandler(createCampusNoticeController),
);
campusRouter.put(
  "/notices/:id",
  requirePermission("settings.manage"),
  asyncHandler(updateCampusNoticeController),
);
campusRouter.delete(
  "/notices/:id",
  requirePermission("settings.manage"),
  asyncHandler(deleteCampusNoticeController),
);

campusRouter.get(
  "/notifications",
  asyncHandler(listNotificationsController),
);
campusRouter.get(
  "/notifications/unread-count",
  asyncHandler(getUnreadCountController),
);
campusRouter.post(
  "/notifications",
  requirePermission("notifications.manage"),
  asyncHandler(createNotificationController),
);
campusRouter.put(
  "/notifications/read-all",
  asyncHandler(markAllReadController),
);
campusRouter.put(
  "/notifications/:id/read",
  asyncHandler(markReadController),
);
campusRouter.post(
  "/notifications/fee-overdue",
  requirePermission("fees.manage"),
  asyncHandler(sendFeeOverdueRemindersController),
);
campusRouter.post(
  "/notifications/push/subscribe",
  asyncHandler(subscribePushController),
);
campusRouter.delete(
  "/notifications/push/unsubscribe",
  asyncHandler(unsubscribePushController),
);
campusRouter.post(
  "/notifications/push/test",
  asyncHandler(testPushController),
);
campusRouter.post(
  "/notifications/sms/send",
  requireAnyPermission("notifications.manage", "fees.manage"),
  asyncHandler(sendSmsController),
);

campusRouter.get(
  "/transport/routes",
  requirePermission("transport.view"),
  asyncHandler(listTransportRoutesController),
);
campusRouter.post(
  "/transport/routes",
  requirePermission("transport.manage"),
  asyncHandler(createTransportRouteController),
);
campusRouter.put(
  "/transport/routes/:id",
  requirePermission("transport.manage"),
  asyncHandler(updateTransportRouteController),
);
campusRouter.patch(
  "/transport/routes/:id",
  requirePermission("transport.manage"),
  asyncHandler(updateTransportRouteController),
);
campusRouter.delete(
  "/transport/routes/:id",
  requirePermission("transport.manage"),
  asyncHandler(deleteTransportRouteController),
);
campusRouter.get(
  "/transport/routes/:id/students",
  requirePermission("transport.view"),
  asyncHandler(listRouteStudentsController),
);
campusRouter.get(
  "/transport/logs",
  requirePermission("transport.view"),
  asyncHandler(listTransportLogsController),
);
campusRouter.post(
  "/transport/assign",
  requirePermission("transport.manage"),
  asyncHandler(assignTransportStudentController),
);

campusRouter.get(
  "/hostel/blocks",
  requirePermission("hostel.view"),
  asyncHandler(listHostelBlocksController),
);
campusRouter.post(
  "/hostel/blocks",
  requirePermission("hostel.manage"),
  asyncHandler(createHostelBlockController),
);
campusRouter.put(
  "/hostel/blocks/:id",
  requirePermission("hostel.manage"),
  asyncHandler(updateHostelBlockController),
);
campusRouter.delete(
  "/hostel/blocks/:id",
  requirePermission("hostel.manage"),
  asyncHandler(deleteHostelBlockController),
);
campusRouter.get(
  "/hostel/rooms",
  requirePermission("hostel.view"),
  asyncHandler(listHostelRoomsController),
);
campusRouter.post(
  "/hostel/rooms",
  requirePermission("hostel.manage"),
  asyncHandler(createHostelRoomController),
);
campusRouter.put(
  "/hostel/rooms/:id",
  requirePermission("hostel.manage"),
  asyncHandler(updateHostelRoomController),
);
campusRouter.delete(
  "/hostel/rooms/:id",
  requirePermission("hostel.manage"),
  asyncHandler(deleteHostelRoomController),
);
campusRouter.get(
  "/hostel/rooms/:id/students",
  requirePermission("hostel.view"),
  asyncHandler(listRoomStudentsController),
);
campusRouter.get(
  "/hostel/beds",
  requirePermission("hostel.view"),
  asyncHandler(listHostelBedsController),
);
campusRouter.post(
  "/hostel/beds",
  requirePermission("hostel.manage"),
  asyncHandler(createHostelBedController),
);
campusRouter.delete(
  "/hostel/beds/:id",
  requirePermission("hostel.manage"),
  asyncHandler(deleteHostelBedController),
);
campusRouter.get(
  "/hostel/logs",
  requirePermission("hostel.view"),
  asyncHandler(listHostelLogsController),
);
campusRouter.post(
  "/hostel/assign",
  requirePermission("hostel.manage"),
  asyncHandler(assignHostelStudentController),
);

campusRouter.get(
  "/library/summary",
  requirePermission("library.view"),
  asyncHandler(librarySummaryController),
);
campusRouter.get(
  "/library/categories",
  requirePermission("library.view"),
  asyncHandler(listLibraryCategoriesController),
);
campusRouter.post(
  "/library/categories",
  requirePermission("library.manage"),
  asyncHandler(createLibraryCategoryController),
);
campusRouter.put(
  "/library/categories/:id",
  requirePermission("library.manage"),
  asyncHandler(updateLibraryCategoryController),
);
campusRouter.delete(
  "/library/categories/:id",
  requirePermission("library.manage"),
  asyncHandler(deleteLibraryCategoryController),
);
campusRouter.get(
  "/library/books",
  requirePermission("library.view"),
  asyncHandler(listLibraryBooksController),
);
campusRouter.post(
  "/library/books",
  requirePermission("library.manage"),
  asyncHandler(createLibraryBookController),
);
campusRouter.put(
  "/library/books/:id",
  requirePermission("library.manage"),
  asyncHandler(updateLibraryBookController),
);
campusRouter.delete(
  "/library/books/:id",
  requirePermission("library.manage"),
  asyncHandler(deleteLibraryBookController),
);
campusRouter.get(
  "/library/loans",
  requirePermission("library.view"),
  asyncHandler(listLibraryLoansController),
);
campusRouter.post(
  "/library/issue",
  requirePermission("library.manage"),
  asyncHandler(issueLibraryBookController),
);
campusRouter.post(
  "/library/loans/:id/return",
  requirePermission("library.manage"),
  asyncHandler(returnLibraryBookController),
);

campusRouter.get(
  "/inventory/summary",
  requirePermission("inventory.view"),
  asyncHandler(inventorySummaryController),
);
campusRouter.get(
  "/inventory/categories",
  requirePermission("inventory.view"),
  asyncHandler(listInventoryCategoriesController),
);
campusRouter.post(
  "/inventory/categories",
  requirePermission("inventory.manage"),
  asyncHandler(createInventoryCategoryController),
);
campusRouter.put(
  "/inventory/categories/:id",
  requirePermission("inventory.manage"),
  asyncHandler(updateInventoryCategoryController),
);
campusRouter.delete(
  "/inventory/categories/:id",
  requirePermission("inventory.manage"),
  asyncHandler(deleteInventoryCategoryController),
);
campusRouter.get(
  "/inventory/items",
  requirePermission("inventory.view"),
  asyncHandler(listInventoryItemsController),
);
campusRouter.post(
  "/inventory/items",
  requirePermission("inventory.manage"),
  asyncHandler(createInventoryItemController),
);
campusRouter.put(
  "/inventory/items/:id",
  requirePermission("inventory.manage"),
  asyncHandler(updateInventoryItemController),
);
campusRouter.delete(
  "/inventory/items/:id",
  requirePermission("inventory.manage"),
  asyncHandler(deleteInventoryItemController),
);
campusRouter.get(
  "/inventory/movements",
  requirePermission("inventory.view"),
  asyncHandler(listInventoryMovementsController),
);
campusRouter.post(
  "/inventory/stock/add",
  requirePermission("inventory.manage"),
  asyncHandler(addInventoryStockController),
);
campusRouter.post(
  "/inventory/issue",
  requirePermission("inventory.manage"),
  asyncHandler(issueInventoryItemController),
);
campusRouter.post(
  "/inventory/return",
  requirePermission("inventory.manage"),
  asyncHandler(returnInventoryItemController),
);

campusRouter.get(
  "/online-exams/summary",
  requirePermission("online_exam.view"),
  asyncHandler(onlineExamSummaryController),
);
campusRouter.get(
  "/online-exams/attempts/list",
  requirePermission("online_exam.view"),
  asyncHandler(listOnlineAttemptsController),
);
campusRouter.get(
  "/online-exams/pending-grades",
  requirePermission("online_exam.view"),
  asyncHandler(listPendingSubjectiveGradesController),
);
campusRouter.post(
  "/online-exams/attempts/start",
  requirePermission("online_exam.manage"),
  asyncHandler(startOnlineAttemptController),
);
campusRouter.post(
  "/online-exams/attempts/:id/submit",
  requirePermission("online_exam.manage"),
  asyncHandler(submitOnlineAttemptController),
);
campusRouter.post(
  "/online-exams/answers/:id/grade",
  requirePermission("online_exam.manage"),
  asyncHandler(gradeSubjectiveAnswerController),
);
campusRouter.put(
  "/online-exams/questions/:id",
  requirePermission("online_exam.manage"),
  asyncHandler(updateOnlineQuestionController),
);
campusRouter.delete(
  "/online-exams/questions/:id",
  requirePermission("online_exam.manage"),
  asyncHandler(deleteOnlineQuestionController),
);
campusRouter.get(
  "/online-exams",
  requirePermission("online_exam.view"),
  asyncHandler(listOnlineExamsController),
);
campusRouter.post(
  "/online-exams",
  requirePermission("online_exam.manage"),
  asyncHandler(createOnlineExamController),
);
campusRouter.get(
  "/online-exams/:examId/questions",
  requirePermission("online_exam.view"),
  asyncHandler(listOnlineQuestionsController),
);
campusRouter.post(
  "/online-exams/:examId/questions",
  requirePermission("online_exam.manage"),
  asyncHandler(createOnlineQuestionController),
);
campusRouter.get(
  "/online-exams/:examId/ranks",
  requirePermission("online_exam.view"),
  asyncHandler(listExamRanksController),
);
campusRouter.get(
  "/online-exams/:id",
  requirePermission("online_exam.view"),
  asyncHandler(getOnlineExamController),
);
campusRouter.put(
  "/online-exams/:id",
  requirePermission("online_exam.manage"),
  asyncHandler(updateOnlineExamController),
);
campusRouter.delete(
  "/online-exams/:id",
  requirePermission("online_exam.manage"),
  asyncHandler(deleteOnlineExamController),
);

campusRouter.get(
  "/permissions",
  requirePermission("roles.view"),
  asyncHandler(listPermissionsController),
);
campusRouter.get("/roles", requirePermission("roles.view"), asyncHandler(listRolesController));
campusRouter.post("/roles", requirePermission("roles.manage"), asyncHandler(createRoleController));
campusRouter.put("/roles/:id", requirePermission("roles.manage"), asyncHandler(updateRoleController));
campusRouter.delete(
  "/roles/:id",
  requirePermission("roles.manage"),
  asyncHandler(deleteRoleController),
);
campusRouter.get(
  "/erp/staff-roles-setup",
  requireAnyPermission("roles.view", "erp.view", "settings.view", "hr.view"),
  asyncHandler(getStaffRolesSetupController),
);
campusRouter.post(
  "/erp/staff-roles/:id/assign",
  requireAnyPermission("roles.manage", "erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(assignStaffToRoleController),
);
campusRouter.delete(
  "/erp/staff-roles/:id/users/:userId",
  requireAnyPermission("roles.manage", "erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(removeStaffFromRoleController),
);
campusRouter.get("/users", requirePermission("users.view"), asyncHandler(listUsersController));
campusRouter.get("/users/:id", requirePermission("users.view"), asyncHandler(getUserController));
campusRouter.post("/users", requirePermission("users.manage"), asyncHandler(createUserController));
campusRouter.put("/users/:id", requirePermission("users.manage"), asyncHandler(updateUserController));
campusRouter.delete("/users/:id", requirePermission("users.manage"), asyncHandler(deleteUserController));

campusRouter.get(
  "/academics/setup",
  requireAnyPermission("academics.view", "erp.view", "settings.view"),
  asyncHandler(getAcademicSetupController),
);
campusRouter.get(
  "/academic-sessions",
  requireAnyPermission("sessions.manage", "academics.view", "erp.view", "settings.view"),
  asyncHandler(listSessionsController),
);
campusRouter.post(
  "/academic-sessions",
  requireAnyPermission("sessions.manage", "erp.manage", "settings.manage"),
  asyncHandler(createSessionController),
);
campusRouter.put(
  "/academic-sessions/:id",
  requireAnyPermission("sessions.manage", "erp.manage", "settings.manage"),
  asyncHandler(updateSessionController),
);
campusRouter.put(
  "/academic-sessions/:id/current",
  requireAnyPermission("sessions.manage", "erp.manage", "settings.manage"),
  asyncHandler(setCurrentSessionController),
);
campusRouter.delete(
  "/academic-sessions/:id",
  requireAnyPermission("sessions.manage", "erp.manage", "settings.manage"),
  asyncHandler(deleteSessionController),
);
campusRouter.post(
  "/academics/classes",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(createClassController),
);
campusRouter.put(
  "/academics/classes/reorder",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(reorderClassesController),
);
campusRouter.put(
  "/academics/classes/:id",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(updateClassController),
);
campusRouter.post(
  "/academics/sections",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(createSectionController),
);
campusRouter.put(
  "/academics/sections/:id",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(updateSectionController),
);
campusRouter.post(
  "/academics/subjects",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(createSubjectController),
);
campusRouter.put(
  "/academics/subjects/reorder",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(reorderSubjectsController),
);
campusRouter.put(
  "/academics/subjects/:id",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(updateSubjectController),
);
campusRouter.post(
  "/academics/class-sections",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(createClassSectionController),
);
campusRouter.put(
  "/academics/class-sections/:id",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(updateClassSectionController),
);
campusRouter.post(
  "/academics/subject-assignments",
  requirePermission("academics.manage"),
  asyncHandler(assignSubjectController),
);

campusRouter.post(
  "/academics/promote",
  requirePermission("academics.manage"),
  asyncHandler(promoteStudentsController),
);
campusRouter.get(
  "/academics/promote/board",
  requirePermission("academics.view"),
  asyncHandler(getPromoteBoardController),
);
campusRouter.post(
  "/academics/bulk-section",
  requirePermission("academics.manage"),
  asyncHandler(bulkUpdateStudentSectionsController),
);
campusRouter.post(
  "/academics/bulk-update",
  requirePermission("academics.manage"),
  asyncHandler(applyAcademicBulkUpdateController),
);
campusRouter.post(
  "/academics/elective-categories",
  requirePermission("academics.manage"),
  asyncHandler(createElectiveCategoryController),
);
campusRouter.put(
  "/academics/elective-categories/:id",
  requirePermission("academics.manage"),
  asyncHandler(updateElectiveCategoryController),
);
campusRouter.delete(
  "/academics/elective-categories/:id",
  requirePermission("academics.manage"),
  asyncHandler(deleteElectiveCategoryController),
);
campusRouter.get(
  "/academics/electives/board",
  requirePermission("academics.view"),
  asyncHandler(getElectiveAssignmentBoardController),
);
campusRouter.put(
  "/academics/electives/assignments",
  requirePermission("academics.manage"),
  asyncHandler(saveStudentElectivesController),
);

campusRouter.get(
  "/academics/subject-groups",
  requirePermission("academics.view"),
  asyncHandler(listSubjectGroupsController),
);
campusRouter.post(
  "/academics/subject-groups",
  requirePermission("academics.manage"),
  asyncHandler(createSubjectGroupController),
);
campusRouter.put(
  "/academics/subject-groups/:id",
  requirePermission("academics.manage"),
  asyncHandler(updateSubjectGroupController),
);
campusRouter.delete(
  "/academics/subject-groups/:id",
  requirePermission("academics.manage"),
  asyncHandler(deleteSubjectGroupController),
);

campusRouter.get(
  "/academics/scholars",
  requirePermission("academics.view"),
  asyncHandler(listSchoolScholarsController),
);
campusRouter.post(
  "/academics/scholars",
  requirePermission("academics.manage"),
  asyncHandler(createSchoolScholarController),
);
campusRouter.put(
  "/academics/scholars/:id",
  requirePermission("academics.manage"),
  asyncHandler(updateSchoolScholarController),
);
campusRouter.delete(
  "/academics/scholars/:id",
  requirePermission("academics.manage"),
  asyncHandler(deleteSchoolScholarController),
);

campusRouter.get(
  "/academics/reports/catalog",
  requirePermission("academics.view"),
  asyncHandler(getAcademicReportCatalogController),
);
campusRouter.get(
  "/academics/reports/run",
  requirePermission("academics.view"),
  asyncHandler(runAcademicReportController),
);

campusRouter.get(
  "/academics/timetable/setup",
  requirePermission("academics.view"),
  asyncHandler(getAcademicsTimetableSetupController),
);
campusRouter.post(
  "/academics/timetable/entries",
  requirePermission("academics.manage"),
  asyncHandler(createAcademicsTimetableEntryController),
);
campusRouter.put(
  "/academics/timetable/entries/:id",
  requirePermission("academics.manage"),
  asyncHandler(updateAcademicsTimetableEntryController),
);
campusRouter.delete(
  "/academics/timetable/entries/:id",
  requirePermission("academics.manage"),
  asyncHandler(deleteAcademicsTimetableEntryController),
);

campusRouter.delete(
  "/academics/:resource/:id",
  requireAnyPermission("academics.manage", "erp.manage", "settings.manage"),
  asyncHandler(deleteAcademicRecordController),
);

campusRouter.get(
  "/students/setup",
  requirePermission("students.view"),
  asyncHandler(getStudentSetupController),
);
campusRouter.get(
  "/students/admissions",
  requirePermission("students.view"),
  asyncHandler(listOnlineAdmissionsController),
);
campusRouter.post(
  "/students/admissions/:id/accept",
  requirePermission("students.manage"),
  asyncHandler(acceptOnlineAdmissionController),
);
campusRouter.post(
  "/students/admissions/:id/reject",
  requirePermission("students.manage"),
  asyncHandler(rejectOnlineAdmissionController),
);
campusRouter.post(
  "/students/import",
  requirePermission("students.manage"),
  asyncHandler(importStudentsController),
);
campusRouter.post(
  "/students/siblings",
  requirePermission("students.manage"),
  asyncHandler(linkSiblingsController),
);
campusRouter.post(
  "/students/delete",
  requirePermission("students.manage"),
  asyncHandler(deleteStudentsController),
);
campusRouter.post(
  "/students/photos/bulk",
  requirePermission("students.manage"),
  avatarUpload.array("photos", 20),
  asyncHandler(bulkUploadStudentPhotosController),
);
campusRouter.get(
  "/students/app-download-status",
  requirePermission("students.view"),
  asyncHandler(listAppDownloadStatusController),
);
campusRouter.get(
  "/students/app-download-status/reminder-settings",
  requirePermission("students.view"),
  asyncHandler(getPortalLoginReminderSettingsController),
);
campusRouter.put(
  "/students/app-download-status/reminder-settings",
  requirePermission("students.manage"),
  asyncHandler(updatePortalLoginReminderSettingsController),
);
campusRouter.post(
  "/students/app-download-status/remind",
  requirePermission("students.manage"),
  asyncHandler(sendPortalLoginRemindersController),
);
campusRouter.get(
  "/students/document-folders",
  requirePermission("students.view"),
  asyncHandler(listStudentDocumentFoldersController),
);
campusRouter.get(
  "/students/documents",
  requirePermission("students.view"),
  asyncHandler(listStudentDocumentsBrowserController),
);
campusRouter.post(
  "/students/documents",
  requirePermission("students.manage"),
  documentUpload.single("file"),
  asyncHandler(uploadStudentDocumentController),
);
campusRouter.post(
  "/students/documents/:id/delete",
  requirePermission("students.manage"),
  asyncHandler(deleteStudentDocumentManagedController),
);
campusRouter.get(
  "/students",
  requirePermission("students.view"),
  asyncHandler(listStudentsController),
);
campusRouter.post(
  "/students",
  requirePermission("students.manage"),
  asyncHandler(createStudentController),
);
campusRouter.get(
  "/students/:id",
  requirePermission("students.view"),
  asyncHandler(getStudentDetailController),
);
campusRouter.get(
  "/students/:id/siblings/detect",
  requirePermission("students.view"),
  asyncHandler(detectSiblingsController),
);
campusRouter.get(
  "/students/:id/exams",
  requirePermission("students.view"),
  asyncHandler(getStudentExamsController),
);
campusRouter.get(
  "/students/:id/subjects",
  requirePermission("students.view"),
  asyncHandler(getStudentSubjectsController),
);
campusRouter.get(
  "/students/:id/timeline",
  requirePermission("students.view"),
  asyncHandler(getStudentTimelineController),
);
campusRouter.get(
  "/students/:id/portal-accounts",
  requirePermission("students.view"),
  asyncHandler(getStudentPortalAccountsController),
);
campusRouter.post(
  "/students/:id/portal-password-reset",
  requirePermission("students.manage"),
  asyncHandler(resetStudentPortalPasswordController),
);
campusRouter.put(
  "/students/:id",
  requirePermission("students.manage"),
  asyncHandler(updateStudentController),
);
campusRouter.post(
  "/students/:id/enrollments",
  requirePermission("students.manage"),
  asyncHandler(addEnrollmentController),
);
campusRouter.post(
  "/student-masters/:resource",
  requirePermission("students.manage"),
  asyncHandler(createStudentMasterController),
);
campusRouter.delete(
  "/student-masters/:resource/:id",
  requirePermission("students.manage"),
  asyncHandler(deleteStudentMasterController),
);

campusRouter.get(
  "/fees/setup",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.view", "erp.view", "settings.view"),
  asyncHandler(getFeeSetupController),
);
campusRouter.get(
  "/fees/settings",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.view", "erp.view", "settings.view"),
  asyncHandler(getFeeSettingsController),
);
campusRouter.put(
  "/fees/settings",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(updateFeeSettingsController),
);
campusRouter.get(
  "/fees/multi-fee-books/setup",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.view", "erp.view", "settings.view"),
  asyncHandler(getMultiFeeBookSetupController),
);
campusRouter.post(
  "/fees/multi-fee-books",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(createMultiFeeBookController),
);
campusRouter.put(
  "/fees/multi-fee-books/:id",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(updateMultiFeeBookController),
);
campusRouter.post(
  "/fees/multi-fee-books/:id/copy",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(copyMultiFeeBookController),
);
campusRouter.delete(
  "/fees/multi-fee-books/:id",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(deleteMultiFeeBookController),
);
campusRouter.post(
  "/fees/types",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(createFeeTypeController),
);
campusRouter.put(
  "/fees/types/:id",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(updateFeeTypeController),
);
campusRouter.delete(
  "/fees/types/:id",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(deleteFeeTypeController),
);
campusRouter.post(
  "/fees/groups",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(createFeeGroupController),
);
campusRouter.put(
  "/fees/groups/:id",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(updateFeeGroupController),
);
campusRouter.delete(
  "/fees/groups/:id",
  requireEntitlement("CMS"),
  requireAnyPermission("fees.manage", "erp.manage", "settings.manage"),
  asyncHandler(deleteFeeGroupController),
);
campusRouter.post(
  "/fees/discounts",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(createFeeDiscountController),
);
campusRouter.put(
  "/fees/discounts/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(updateFeeDiscountController),
);
campusRouter.delete(
  "/fees/discounts/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(deleteFeeDiscountController),
);
campusRouter.post(
  "/fees/receipt-books",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(createReceiptBookController),
);
campusRouter.put(
  "/fees/receipt-books/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(updateReceiptBookController),
);
campusRouter.delete(
  "/fees/receipt-books/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(deleteReceiptBookController),
);
campusRouter.post(
  "/fees/masters",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(createFeeMasterController),
);
campusRouter.put(
  "/fees/masters/reorder",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(reorderFeeMastersController),
);
campusRouter.post(
  "/fees/custom",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(createCustomFeeController),
);
campusRouter.put(
  "/fees/custom/:id/active",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(setCustomFeeActiveController),
);
campusRouter.put(
  "/fees/masters/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(updateFeeMasterController),
);
campusRouter.get(
  "/fees/masters/:id/assign-candidates",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(listFeeMasterAssignCandidatesController),
);
campusRouter.delete(
  "/fees/masters/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(deleteFeeMasterController),
);
campusRouter.post(
  "/fees/masters/:id/assign",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(assignFeeMasterController),
);
campusRouter.put(
  "/fees/assignments/:id/discount",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(updateAssignmentDiscountController),
);
campusRouter.get(
  "/fees/students/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.view"),
  asyncHandler(listStudentFeesController),
);
campusRouter.post(
  "/fees/payments",
  requireEntitlement("CMS"),
  requirePermission("fees.collect"),
  asyncHandler(collectPaymentController),
);
campusRouter.get(
  "/fees/payments",
  requireEntitlement("CMS"),
  requirePermission("fees.view"),
  asyncHandler(searchPaymentsController),
);
campusRouter.get(
  "/fees/payments/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.view"),
  asyncHandler(getFeePaymentController),
);
campusRouter.post(
  "/fees/invoices",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(createFeeInvoiceController),
);
campusRouter.get(
  "/fees/invoices",
  requireEntitlement("CMS"),
  requirePermission("fees.view"),
  asyncHandler(listFeeInvoicesController),
);
campusRouter.get(
  "/fees/invoices/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.view"),
  asyncHandler(getFeeInvoiceController),
);
campusRouter.put(
  "/fees/invoices/:id/status",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(setFeeInvoiceStatusController),
);
campusRouter.put(
  "/fees/payments/:id/revert",
  requireEntitlement("CMS"),
  requirePermission("fees.collect"),
  asyncHandler(revertPaymentController),
);
campusRouter.get(
  "/fees/reports/summary",
  requireEntitlement("CMS"),
  requirePermission("fees.view"),
  asyncHandler(getFeeSummaryController),
);
campusRouter.put(
  "/fees/reminders",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(updateFeeReminderController),
);
campusRouter.post(
  "/fees/reminders/run",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(runFeeRemindersController),
);
campusRouter.post(
  "/fees/reminders/student",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(sendStudentFeeReminderController),
);
campusRouter.get(
  "/fees/reminders/stats",
  requireEntitlement("CMS"),
  requirePermission("fees.view"),
  asyncHandler(getFeeReminderStatsController),
);
campusRouter.post(
  "/fees/carry-forward",
  requireEntitlement("CMS"),
  requirePermission("fees.manage"),
  asyncHandler(carryForwardPreviousDuesController),
);
campusRouter.get(
  "/fees/online/config",
  requireEntitlement("CMS"),
  requirePermission("fees.view"),
  asyncHandler(getOnlinePaymentConfigController),
);
campusRouter.post(
  "/fees/online/orders",
  requireEntitlement("CMS"),
  requirePermission("fees.collect"),
  asyncHandler(createOnlineOrderController),
);
campusRouter.get(
  "/fees/online/orders/:id",
  requireEntitlement("CMS"),
  requirePermission("fees.view"),
  asyncHandler(getOnlineOrderController),
);
campusRouter.post(
  "/fees/online/orders/:id/confirm",
  requireEntitlement("CMS"),
  requirePermission("fees.collect"),
  asyncHandler(confirmOnlineOrderController),
);

campusRouter.get(
  "/attendance/setup",
  requirePermission("attendance.view"),
  asyncHandler(getAttendanceSetupController),
);
campusRouter.post(
  "/attendance/records",
  requirePermission("attendance.manage"),
  asyncHandler(markAttendanceController),
);
campusRouter.post(
  "/attendance/scan",
  requirePermission("attendance.manage"),
  asyncHandler(scanAttendanceController),
);
campusRouter.get(
  "/attendance/reports/catalog",
  requirePermission("attendance.view"),
  asyncHandler(getAttendanceReportCatalogController),
);
campusRouter.get(
  "/attendance/reports/run",
  requirePermission("attendance.view"),
  asyncHandler(runAttendancePackReportController),
);
campusRouter.get(
  "/attendance/reports",
  requirePermission("attendance.view"),
  asyncHandler(getAttendanceReportController),
);
campusRouter.post(
  "/attendance/leaves",
  requirePermission("attendance.manage"),
  asyncHandler(createLeaveController),
);
campusRouter.get(
  "/attendance/leaves",
  requirePermission("attendance.view"),
  asyncHandler(listLeavesController),
);
campusRouter.put(
  "/attendance/leaves/:id/review",
  requirePermission("attendance.manage"),
  asyncHandler(reviewLeaveController),
);
campusRouter.post(
  "/attendance/points",
  requirePermission("attendance.manage"),
  asyncHandler(awardAttendancePointsController),
);
campusRouter.get(
  "/attendance/points",
  requirePermission("attendance.view"),
  asyncHandler(getAttendancePointsController),
);
campusRouter.get(
  "/attendance/points/scores",
  requirePermission("attendance.view"),
  asyncHandler(getAttendancePointScoresController),
);
campusRouter.put(
  "/attendance/points/config",
  requirePermission("attendance.manage"),
  asyncHandler(updateAttendancePointConfigController),
);

campusRouter.get(
  "/exams/setup",
  requirePermission("exams.view"),
  asyncHandler(getExamSetupController),
);
campusRouter.post(
  "/exams/grades",
  requirePermission("exams.manage"),
  asyncHandler(createExamGradeController),
);
campusRouter.put(
  "/exams/grades/:id",
  requirePermission("exams.manage"),
  asyncHandler(updateExamGradeController),
);
campusRouter.delete(
  "/exams/grades/:id",
  requirePermission("exams.manage"),
  asyncHandler(deleteExamGradeController),
);
campusRouter.post(
  "/exams/groups",
  requirePermission("exams.manage"),
  asyncHandler(createExamGroupController),
);
campusRouter.put(
  "/exams/groups/:id",
  requirePermission("exams.manage"),
  asyncHandler(updateExamGroupController),
);
campusRouter.delete(
  "/exams/groups/:id",
  requirePermission("exams.manage"),
  asyncHandler(deleteExamGroupController),
);
campusRouter.post(
  "/exams",
  requirePermission("exams.manage"),
  asyncHandler(createExamController),
);
campusRouter.get(
  "/exams/links",
  requirePermission("exams.view"),
  asyncHandler(listExamLinksController),
);
campusRouter.post(
  "/exams/links",
  requirePermission("exams.manage"),
  asyncHandler(createExamLinkController),
);
campusRouter.delete(
  "/exams/links/:id",
  requirePermission("exams.manage"),
  asyncHandler(deleteExamLinkController),
);
campusRouter.get(
  "/exams/links/:id/results",
  requirePermission("exams.view"),
  asyncHandler(getExamLinkResultsController),
);
campusRouter.put(
  "/exams/students/:id/portal-visibility",
  requirePermission("exams.manage"),
  asyncHandler(updateExamStudentPortalVisibilityController),
);
campusRouter.put(
  "/exams/:id",
  requirePermission("exams.manage"),
  asyncHandler(updateExamController),
);
campusRouter.put(
  "/exams/:id/archive",
  requirePermission("exams.manage"),
  asyncHandler(archiveExamController),
);
campusRouter.delete(
  "/exams/:id",
  requirePermission("exams.manage"),
  asyncHandler(deleteExamController),
);
campusRouter.post(
  "/exams/:id/schedules",
  requirePermission("exams.manage"),
  asyncHandler(createExamScheduleController),
);
campusRouter.put(
  "/exams/schedules/:id",
  requirePermission("exams.manage"),
  asyncHandler(updateExamScheduleController),
);
campusRouter.delete(
  "/exams/schedules/:id",
  requirePermission("exams.manage"),
  asyncHandler(deleteExamScheduleController),
);
campusRouter.get(
  "/exams/:id/students",
  requirePermission("exams.view"),
  asyncHandler(listExamStudentsController),
);
campusRouter.post(
  "/exams/:id/students",
  requirePermission("exams.manage"),
  asyncHandler(assignExamStudentsController),
);
campusRouter.post(
  "/exams/:id/aspects",
  requirePermission("exams.manage"),
  asyncHandler(createExamAspectController),
);
campusRouter.put(
  "/exams/aspects/:id",
  requirePermission("exams.manage"),
  asyncHandler(updateExamAspectController),
);
campusRouter.delete(
  "/exams/aspects/:id",
  requirePermission("exams.manage"),
  asyncHandler(deleteExamAspectController),
);
campusRouter.put(
  "/exams/components/:id",
  requirePermission("exams.manage"),
  asyncHandler(updateMarkComponentController),
);
campusRouter.delete(
  "/exams/components/:id",
  requirePermission("exams.manage"),
  asyncHandler(deleteMarkComponentController),
);
campusRouter.put(
  "/exams/schedules/:id/components/reorder",
  requirePermission("exams.manage"),
  asyncHandler(reorderMarkComponentsController),
);
campusRouter.get(
  "/exams/subject-links",
  requirePermission("exams.view"),
  asyncHandler(listExamSubjectLinksController),
);
campusRouter.post(
  "/exams/subject-links",
  requirePermission("exams.manage"),
  asyncHandler(saveExamSubjectLinkController),
);
campusRouter.put(
  "/exams/subject-links",
  requirePermission("exams.manage"),
  asyncHandler(saveExamSubjectLinkController),
);
campusRouter.delete(
  "/exams/subject-links/:id",
  requirePermission("exams.manage"),
  asyncHandler(deleteExamSubjectLinkController),
);
campusRouter.put(
  "/exams/:id/publish",
  requirePermission("exams.publish"),
  asyncHandler(publishExamController),
);
campusRouter.put(
  "/exams/:id/unpublish",
  requirePermission("exams.publish"),
  asyncHandler(unpublishExamController),
);
campusRouter.get(
  "/exams/groups/:id/results",
  requirePermission("exams.view"),
  asyncHandler(getExamGroupResultsController),
);
campusRouter.get(
  "/exams/:id/results",
  requirePermission("exams.view"),
  asyncHandler(getExamResultsController),
);
campusRouter.get(
  "/exams/schedules/:id/roster",
  requirePermission("exams.view"),
  asyncHandler(getScheduleRosterController),
);
campusRouter.put(
  "/exams/schedules/:id/marks",
  requirePermission("exams.manage"),
  asyncHandler(saveExamMarksController),
);
campusRouter.post(
  "/exams/schedules/:scheduleId/components",
  requirePermission("exams.manage"),
  asyncHandler(addMarkComponentController),
);
campusRouter.put(
  "/exams/aspects/:id/values",
  requirePermission("exams.manage"),
  asyncHandler(saveAspectValuesController),
);

campusRouter.get(
  "/hr/setup",
  requireEntitlement("CMS"),
  requirePermission("hr.view"),
  asyncHandler(getHrSetupController),
);
campusRouter.post(
  "/hr/departments",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(createDepartmentController),
);
campusRouter.post(
  "/hr/designations",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(createDesignationController),
);
campusRouter.post(
  "/hr/leave-types",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(createStaffLeaveTypeController),
);
campusRouter.put(
  "/hr/departments/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(updateDepartmentController),
);
campusRouter.delete(
  "/hr/departments/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(deleteDepartmentController),
);
campusRouter.put(
  "/hr/designations/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(updateDesignationController),
);
campusRouter.delete(
  "/hr/designations/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(deleteDesignationController),
);
campusRouter.put(
  "/hr/leave-types/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(updateStaffLeaveTypeController),
);
campusRouter.delete(
  "/hr/leave-types/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(deleteStaffLeaveTypeController),
);
campusRouter.post(
  "/hr/pay-parameters",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(createPayParameterController),
);
campusRouter.put(
  "/hr/pay-parameters/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(updatePayParameterController),
);
campusRouter.delete(
  "/hr/pay-parameters/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(deletePayParameterController),
);
campusRouter.post(
  "/hr/staff",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(createStaffProfileController),
);
campusRouter.get(
  "/hr/staff/disabled",
  requireEntitlement("CMS"),
  requirePermission("hr.view"),
  asyncHandler(listDisabledStaffController),
);
campusRouter.get(
  "/hr/staff/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.view"),
  asyncHandler(getStaffDetailController),
);
campusRouter.put(
  "/hr/staff/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(updateStaffProfileController),
);
campusRouter.delete(
  "/hr/staff/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(deleteStaffProfileController),
);
campusRouter.put(
  "/hr/staff/:id/status",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(updateStaffStatusController),
);
campusRouter.post(
  "/hr/attendance",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(markStaffAttendanceController),
);
campusRouter.get(
  "/hr/attendance",
  requireEntitlement("CMS"),
  requirePermission("hr.view"),
  asyncHandler(getStaffAttendanceReportController),
);
campusRouter.get(
  "/erp/staff-attendance-settings",
  requireAnyPermission("erp.view", "settings.view", "hr.view"),
  asyncHandler(getStaffAttendanceSettingsController),
);
campusRouter.put(
  "/erp/staff-attendance-settings",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(updateStaffAttendanceSettingsController),
);
campusRouter.post(
  "/erp/staff-work-shifts",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(createStaffWorkShiftController),
);
campusRouter.put(
  "/erp/staff-work-shifts/:id",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(updateStaffWorkShiftController),
);
campusRouter.delete(
  "/erp/staff-work-shifts/:id",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(deleteStaffWorkShiftController),
);
campusRouter.post(
  "/erp/staff-attendance-holidays",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(upsertStaffHolidayController),
);
campusRouter.put(
  "/erp/staff-attendance-holidays/:id",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(upsertStaffHolidayController),
);
campusRouter.delete(
  "/erp/staff-attendance-holidays/:id",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(deleteStaffHolidayController),
);
campusRouter.get(
  "/erp/leave-types-setup",
  requireAnyPermission("erp.view", "settings.view", "hr.view"),
  asyncHandler(getLeaveTypesSetupController),
);
campusRouter.post(
  "/erp/leave-types",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(createLeaveTypeSettingsController),
);
campusRouter.put(
  "/erp/leave-types/:id",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(updateLeaveTypeSettingsController),
);
campusRouter.delete(
  "/erp/leave-types/:id",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage"),
  asyncHandler(deleteLeaveTypeSettingsController),
);
campusRouter.get(
  "/erp/payroll-settings",
  requireAnyPermission("erp.view", "settings.view", "hr.view", "payroll.view"),
  asyncHandler(getPayrollSettingsSetupController),
);
campusRouter.put(
  "/erp/payroll-settings",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage", "payroll.manage"),
  asyncHandler(updatePayrollSettingsController),
);
campusRouter.post(
  "/erp/payroll-components",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage", "payroll.manage"),
  asyncHandler(createPayComponentController),
);
campusRouter.put(
  "/erp/payroll-components/:id",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage", "payroll.manage"),
  asyncHandler(updatePayComponentController),
);
campusRouter.delete(
  "/erp/payroll-components/:id",
  requireAnyPermission("erp.manage", "settings.manage", "hr.manage", "payroll.manage"),
  asyncHandler(deletePayComponentController),
);
campusRouter.post(
  "/hr/leaves",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(applyStaffLeaveController),
);
campusRouter.post(
  "/hr/leaves/mine",
  requireEntitlement("CMS"),
  requirePermission("hr.view"),
  asyncHandler(applyOwnStaffLeaveController),
);
campusRouter.get(
  "/hr/leaves/:id",
  requireEntitlement("CMS"),
  requirePermission("hr.view"),
  asyncHandler(getStaffLeaveController),
);
campusRouter.put(
  "/hr/leaves/:id/review",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(reviewStaffLeaveController),
);
campusRouter.post(
  "/hr/staff/:id/adjustments",
  requireEntitlement("CMS"),
  requirePermission("payroll.manage"),
  asyncHandler(addStaffAdjustmentController),
);
campusRouter.put(
  "/hr/adjustments/:id",
  requireEntitlement("CMS"),
  requirePermission("payroll.manage"),
  asyncHandler(updateStaffAdjustmentController),
);
campusRouter.delete(
  "/hr/adjustments/:id",
  requireEntitlement("CMS"),
  requirePermission("payroll.manage"),
  asyncHandler(deleteStaffAdjustmentController),
);
campusRouter.post(
  "/hr/payroll",
  requireEntitlement("CMS"),
  requirePermission("payroll.manage"),
  asyncHandler(generatePayrollController),
);
campusRouter.get(
  "/hr/payroll/:id/payslip",
  requireEntitlement("CMS"),
  requirePermission("hr.view"),
  asyncHandler(getPayrollPayslipController),
);
campusRouter.put(
  "/hr/payroll/:id/pay",
  requireEntitlement("CMS"),
  requirePermission("payroll.manage"),
  asyncHandler(payPayrollController),
);
campusRouter.put(
  "/hr/payroll/:id/revert",
  requireEntitlement("CMS"),
  requirePermission("payroll.manage"),
  asyncHandler(revertPayrollController),
);
campusRouter.post(
  "/hr/ratings",
  requireEntitlement("CMS"),
  requirePermission("hr.manage"),
  asyncHandler(addTeacherRatingController),
);
campusRouter.get(
  "/hr/ratings/summary",
  requireEntitlement("CMS"),
  requirePermission("hr.view"),
  asyncHandler(getTeacherRatingsSummaryController),
);

campusRouter.get(
  "/documents/templates",
  requirePermission("documents.view"),
  asyncHandler(listDocumentTemplatesController),
);
campusRouter.post(
  "/documents/templates",
  requirePermission("documents.manage"),
  asyncHandler(createDocumentTemplateController),
);
campusRouter.put(
  "/documents/templates/:id",
  requirePermission("documents.manage"),
  asyncHandler(updateDocumentTemplateController),
);
campusRouter.delete(
  "/documents/templates/:id",
  requirePermission("documents.manage"),
  asyncHandler(deleteDocumentTemplateController),
);
campusRouter.get(
  "/documents/generated",
  requirePermission("documents.view"),
  asyncHandler(listGeneratedDocumentsController),
);
campusRouter.get(
  "/documents/generated/:id",
  requirePermission("documents.view"),
  asyncHandler(getGeneratedDocumentController),
);
campusRouter.post(
  "/documents/generated/bulk",
  requirePermission("documents.generate"),
  asyncHandler(generateDocumentsBulkController),
);
campusRouter.post(
  "/documents/generated",
  requirePermission("documents.generate"),
  asyncHandler(generateDocumentController),
);

campusRouter.get(
  "/reports",
  requirePermission("reports.view"),
  asyncHandler(getReportHubController),
);
campusRouter.get(
  "/reports/core/:reportKey",
  requirePermission("reports.view"),
  asyncHandler(runCoreReportController),
);
campusRouter.get(
  "/reports/student/:reportKey",
  requirePermission("reports.view"),
  asyncHandler(runStudentReportController),
);
campusRouter.get(
  "/reports/fee/:reportKey",
  requirePermission("reports.view"),
  asyncHandler(runFeeReportController),
);
campusRouter.get(
  "/reports/extra/:reportKey",
  requirePermission("reports.view"),
  asyncHandler(runExtraReportController),
);
campusRouter.get(
  "/reports/:module",
  requirePermission("reports.view"),
  asyncHandler(runModuleReportController),
);

campusRouter.get(
  "/timetable/setup",
  requirePermission("timetable.view"),
  asyncHandler(getTimetableSetupController),
);
campusRouter.post(
  "/timetable/entries",
  requirePermission("timetable.manage"),
  asyncHandler(createTimetableEntryController),
);
campusRouter.put(
  "/timetable/entries/:id",
  requirePermission("timetable.manage"),
  asyncHandler(updateTimetableEntryController),
);
campusRouter.delete(
  "/timetable/entries/:id",
  requirePermission("timetable.manage"),
  asyncHandler(deleteTimetableEntryController),
);
campusRouter.get(
  "/timetable/reports/free-periods",
  requirePermission("timetable.manage"),
  asyncHandler(getFreePeriodReportController),
);

campusRouter.get(
  "/homework/setup",
  requirePermission("homework.view"),
  asyncHandler(getHomeworkSetupController),
);
campusRouter.get(
  "/erp/student-access",
  requireAnyPermission("erp.view", "settings.view", "students.view"),
  asyncHandler(getStudentAccessSettingsController),
);
campusRouter.put(
  "/erp/student-access",
  requireAnyPermission("erp.manage", "settings.manage", "students.manage"),
  asyncHandler(updateStudentAccessSettingsController),
);
campusRouter.get(
  "/erp/homework-settings",
  requireAnyPermission("erp.view", "settings.view", "homework.view"),
  asyncHandler(getHomeworkSettingsSetupController),
);
campusRouter.put(
  "/erp/homework-settings",
  requireAnyPermission("erp.manage", "settings.manage", "homework.manage"),
  asyncHandler(updateHomeworkSettingsController),
);
campusRouter.post(
  "/erp/homework-types",
  requireAnyPermission("erp.manage", "settings.manage", "homework.manage"),
  asyncHandler(createHomeworkTypeController),
);
campusRouter.put(
  "/erp/homework-types/:id",
  requireAnyPermission("erp.manage", "settings.manage", "homework.manage"),
  asyncHandler(updateHomeworkTypeController),
);
campusRouter.delete(
  "/erp/homework-types/:id",
  requireAnyPermission("erp.manage", "settings.manage", "homework.manage"),
  asyncHandler(deleteHomeworkTypeController),
);
campusRouter.post(
  "/erp/homework-workflow-statuses",
  requireAnyPermission("erp.manage", "settings.manage", "homework.manage"),
  asyncHandler(createHomeworkWorkflowStatusController),
);
campusRouter.put(
  "/erp/homework-workflow-statuses/:id",
  requireAnyPermission("erp.manage", "settings.manage", "homework.manage"),
  asyncHandler(updateHomeworkWorkflowStatusController),
);
campusRouter.delete(
  "/erp/homework-workflow-statuses/:id",
  requireAnyPermission("erp.manage", "settings.manage", "homework.manage"),
  asyncHandler(deleteHomeworkWorkflowStatusController),
);
campusRouter.get(
  "/homework/:id",
  requirePermission("homework.view"),
  asyncHandler(getHomeworkController),
);
campusRouter.post(
  "/homework",
  requirePermission("homework.manage"),
  asyncHandler(createHomeworkController),
);
campusRouter.put(
  "/homework/:id",
  requirePermission("homework.manage"),
  asyncHandler(updateHomeworkController),
);
campusRouter.get(
  "/homework/:id/submissions",
  requirePermission("homework.evaluate"),
  asyncHandler(getHomeworkSubmissionsController),
);
campusRouter.post(
  "/homework/:id/submissions",
  requirePermission("homework.submit"),
  asyncHandler(submitHomeworkController),
);
campusRouter.put(
  "/homework/submissions/:id/evaluate",
  requirePermission("homework.evaluate"),
  asyncHandler(evaluateHomeworkSubmissionController),
);
campusRouter.get(
  "/homework-reports",
  requirePermission("homework.evaluate"),
  asyncHandler(getHomeworkReportController),
);
campusRouter.get(
  "/homework-reports/:reportKey",
  requirePermission("homework.evaluate"),
  asyncHandler(getHomeworkNamedReportController),
);
campusRouter.get(
  "/reports/homework/:reportKey",
  requirePermission("reports.view"),
  asyncHandler(getHomeworkNamedReportController),
);

campusRouter.get(
  "/erp/question-bank-settings",
  requireAnyPermission("erp.view", "settings.view", "online_exam.view", "exams.view"),
  asyncHandler(getQuestionBankSettingsController),
);
campusRouter.put(
  "/erp/question-bank-settings",
  requireAnyPermission("erp.manage", "settings.manage", "online_exam.manage", "exams.manage"),
  asyncHandler(updateQuestionBankSettingsController),
);
campusRouter.put(
  "/erp/question-bank-settings/difficulty",
  requireAnyPermission("erp.manage", "settings.manage", "online_exam.manage", "exams.manage"),
  asyncHandler(upsertQuestionBankDifficultyController),
);
campusRouter.delete(
  "/erp/question-bank-settings/difficulty/:id",
  requireAnyPermission("erp.manage", "settings.manage", "online_exam.manage", "exams.manage"),
  asyncHandler(deleteQuestionBankDifficultyController),
);

campusRouter.get(
  "/erp/grading-scale-setup",
  requireAnyPermission("erp.view", "settings.view", "exams.view", "academics.view"),
  asyncHandler(getGradingScaleSetupController),
);
campusRouter.post(
  "/erp/grading-scales",
  requireAnyPermission("erp.manage", "settings.manage", "exams.manage", "academics.manage"),
  asyncHandler(createGradingScaleController),
);
campusRouter.put(
  "/erp/grading-scales/:id",
  requireAnyPermission("erp.manage", "settings.manage", "exams.manage", "academics.manage"),
  asyncHandler(updateGradingScaleController),
);
campusRouter.delete(
  "/erp/grading-scales/:id",
  requireAnyPermission("erp.manage", "settings.manage", "exams.manage", "academics.manage"),
  asyncHandler(deleteGradingScaleController),
);
campusRouter.post(
  "/erp/grading-scales/:scaleId/grades",
  requireAnyPermission("erp.manage", "settings.manage", "exams.manage", "academics.manage"),
  asyncHandler(createGradingScaleGradeController),
);
campusRouter.put(
  "/erp/grading-scale-grades/:id",
  requireAnyPermission("erp.manage", "settings.manage", "exams.manage", "academics.manage"),
  asyncHandler(updateGradingScaleGradeController),
);
campusRouter.delete(
  "/erp/grading-scale-grades/:id",
  requireAnyPermission("erp.manage", "settings.manage", "exams.manage", "academics.manage"),
  asyncHandler(deleteGradingScaleGradeController),
);
campusRouter.put(
  "/erp/grading-scale-assignments",
  requireAnyPermission("erp.manage", "settings.manage", "exams.manage", "academics.manage"),
  asyncHandler(assignGradingScaleToClassesController),
);

campusRouter.get(
  "/erp/timetable-period-setup",
  requireAnyPermission("erp.view", "settings.view", "timetable.view", "academics.view"),
  asyncHandler(getTimetablePeriodSetupController),
);
campusRouter.put(
  "/erp/timetable-period-setup/settings",
  requireAnyPermission("erp.manage", "settings.manage", "timetable.manage", "academics.manage"),
  asyncHandler(updateTimetablePeriodSettingsController),
);
campusRouter.post(
  "/erp/timetable-periods",
  requireAnyPermission("erp.manage", "settings.manage", "timetable.manage", "academics.manage"),
  asyncHandler(createTimetablePeriodController),
);
campusRouter.put(
  "/erp/timetable-periods/:id",
  requireAnyPermission("erp.manage", "settings.manage", "timetable.manage", "academics.manage"),
  asyncHandler(updateTimetablePeriodController),
);
campusRouter.delete(
  "/erp/timetable-periods/:id",
  requireAnyPermission("erp.manage", "settings.manage", "timetable.manage", "academics.manage"),
  asyncHandler(deleteTimetablePeriodController),
);
campusRouter.post(
  "/erp/timetable-templates",
  requireAnyPermission("erp.manage", "settings.manage", "timetable.manage", "academics.manage"),
  asyncHandler(createTimetableTemplateController),
);
campusRouter.put(
  "/erp/timetable-templates/:id",
  requireAnyPermission("erp.manage", "settings.manage", "timetable.manage", "academics.manage"),
  asyncHandler(updateTimetableTemplateController),
);
campusRouter.delete(
  "/erp/timetable-templates/:id",
  requireAnyPermission("erp.manage", "settings.manage", "timetable.manage", "academics.manage"),
  asyncHandler(deleteTimetableTemplateController),
);

campusRouter.get(
  "/erp/setup",
  requireEntitlement("CMS"),
  requirePermission("erp.view"),
  asyncHandler(getErpSetupController),
);
campusRouter.put(
  "/erp/integrations/:category",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(updateIntegrationController),
);
campusRouter.post(
  "/erp/payment-methods",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(createPaymentMethodController),
);
campusRouter.get(
  "/erp/payment-methods/setup",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view"),
  asyncHandler(getPaymentMethodsSetupController),
);
campusRouter.post(
  "/erp/payment-methods/setup",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertPaymentMethodSetupController),
);
campusRouter.delete(
  "/erp/payment-methods/setup/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deletePaymentMethodSetupController),
);
campusRouter.post(
  "/erp/payment-methods/:id/toggle",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(togglePaymentMethodSetupController),
);
campusRouter.put(
  "/erp/payment-methods/:id",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(updatePaymentMethodController),
);
campusRouter.delete(
  "/erp/payment-methods/:id",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(deletePaymentMethodController),
);
campusRouter.put(
  "/erp/modules/:key",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(upsertModuleController),
);
campusRouter.get(
  "/erp/modules-setup",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view"),
  asyncHandler(getModulesSetupController),
);
campusRouter.post(
  "/erp/modules-setup",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(createModuleSetupController),
);
campusRouter.put(
  "/erp/modules-setup/:key",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertModuleSetupController),
);
campusRouter.post(
  "/erp/modules-setup/:key/toggle",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(toggleModuleSetupController),
);
campusRouter.delete(
  "/erp/modules-setup/:key",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteModuleSetupController),
);
campusRouter.get(
  "/erp/data-import-export",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view"),
  asyncHandler(getDataImportExportSetupController),
);
campusRouter.post(
  "/erp/data-import-export/import",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(runDataImportController),
);
campusRouter.delete(
  "/erp/data-import-export/history/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteImportJobController),
);
campusRouter.get(
  "/erp/data-import-export/export/:key",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view"),
  asyncHandler(exportDataController),
);
campusRouter.post(
  "/erp/data-import-export/export",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(runDataExportController),
);
campusRouter.get(
  "/erp/two-factor",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view"),
  asyncHandler(getTwoFactorSetupController),
);
campusRouter.put(
  "/erp/two-factor",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(saveTwoFactorSettingsController),
);
campusRouter.get(
  "/erp/holidays-calendar",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view"),
  asyncHandler(getHolidaysCalendarSetupController),
);
campusRouter.post(
  "/erp/holidays-calendar/holidays",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(createCalendarHolidayController),
);
campusRouter.put(
  "/erp/holidays-calendar/holidays/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(updateCalendarHolidayController),
);
campusRouter.delete(
  "/erp/holidays-calendar/holidays/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteCalendarHolidayController),
);
campusRouter.post(
  "/erp/holidays-calendar/groups",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertHolidayGroupController),
);
campusRouter.put(
  "/erp/holidays-calendar/groups",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertHolidayGroupController),
);
campusRouter.delete(
  "/erp/holidays-calendar/groups/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteHolidayGroupController),
);
campusRouter.put(
  "/erp/holidays-calendar/settings",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(saveHolidaySettingsController),
);
campusRouter.get(
  "/erp/holidays-calendar/export",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view"),
  asyncHandler(exportHolidaysCalendarController),
);
campusRouter.get(
  "/erp/session-login-policy",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view"),
  asyncHandler(getSessionLoginPolicySetupController),
);
campusRouter.put(
  "/erp/session-login-policy",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(saveSessionLoginPolicyController),
);
campusRouter.delete(
  "/erp/session-login-policy/sessions/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(terminateLoginSessionController),
);
campusRouter.post(
  "/erp/session-login-policy/sessions/terminate-others",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(terminateOtherLoginSessionsController),
);
campusRouter.get(
  "/erp/transport-settings",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view", "transport.view"),
  asyncHandler(getTransportSettingsSetupController),
);
campusRouter.put(
  "/erp/transport-settings",
  requireAnyPermission("erp.manage", "settings.manage", "transport.manage"),
  asyncHandler(saveTransportSettingsController),
);
campusRouter.post(
  "/erp/transport-settings/routes",
  requireAnyPermission("erp.manage", "settings.manage", "transport.manage"),
  asyncHandler(upsertTransportSettingsRouteController),
);
campusRouter.put(
  "/erp/transport-settings/routes",
  requireAnyPermission("erp.manage", "settings.manage", "transport.manage"),
  asyncHandler(upsertTransportSettingsRouteController),
);
campusRouter.delete(
  "/erp/transport-settings/routes/:id",
  requireAnyPermission("erp.manage", "settings.manage", "transport.manage"),
  asyncHandler(deleteTransportSettingsRouteController),
);
campusRouter.post(
  "/erp/transport-settings/vehicles",
  requireAnyPermission("erp.manage", "settings.manage", "transport.manage"),
  asyncHandler(upsertTransportVehicleController),
);
campusRouter.put(
  "/erp/transport-settings/vehicles",
  requireAnyPermission("erp.manage", "settings.manage", "transport.manage"),
  asyncHandler(upsertTransportVehicleController),
);
campusRouter.delete(
  "/erp/transport-settings/vehicles/:id",
  requireAnyPermission("erp.manage", "settings.manage", "transport.manage"),
  asyncHandler(deleteTransportVehicleController),
);
campusRouter.get(
  "/erp/library-settings",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view", "library.view"),
  asyncHandler(getLibrarySettingsSetupController),
);
campusRouter.put(
  "/erp/library-settings",
  requireAnyPermission("erp.manage", "settings.manage", "library.manage"),
  asyncHandler(saveLibrarySettingsController),
);
campusRouter.post(
  "/erp/library-settings/member-types",
  requireAnyPermission("erp.manage", "settings.manage", "library.manage"),
  asyncHandler(upsertLibraryMemberTypeController),
);
campusRouter.put(
  "/erp/library-settings/member-types",
  requireAnyPermission("erp.manage", "settings.manage", "library.manage"),
  asyncHandler(upsertLibraryMemberTypeController),
);
campusRouter.delete(
  "/erp/library-settings/member-types/:id",
  requireAnyPermission("erp.manage", "settings.manage", "library.manage"),
  asyncHandler(deleteLibraryMemberTypeController),
);
campusRouter.post(
  "/erp/library-settings/categories",
  requireAnyPermission("erp.manage", "settings.manage", "library.manage"),
  asyncHandler(upsertLibrarySettingsCategoryController),
);
campusRouter.put(
  "/erp/library-settings/categories",
  requireAnyPermission("erp.manage", "settings.manage", "library.manage"),
  asyncHandler(upsertLibrarySettingsCategoryController),
);
campusRouter.delete(
  "/erp/library-settings/categories/:id",
  requireAnyPermission("erp.manage", "settings.manage", "library.manage"),
  asyncHandler(deleteLibrarySettingsCategoryController),
);
campusRouter.get(
  "/erp/library-settings/barcode-preview",
  requireAnyPermission("erp.manage", "settings.manage", "erp.view", "settings.view", "library.view"),
  asyncHandler(previewLibraryBarcodeController),
);
campusRouter.get(
  "/erp/languages",
  requireEntitlement("CMS"),
  requireAnyPermission("erp.view", "settings.view"),
  asyncHandler(listLanguagesController),
);
campusRouter.put(
  "/erp/languages",
  requireEntitlement("CMS"),
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertLanguageController),
);
campusRouter.put(
  "/erp/languages/sync",
  requireEntitlement("CMS"),
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(syncLanguagesController),
);
campusRouter.post(
  "/erp/custom-fields",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(createCustomFieldController),
);
campusRouter.put(
  "/erp/custom-fields/:id",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(updateCustomFieldController),
);
campusRouter.delete(
  "/erp/custom-fields/:id",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(deleteCustomFieldController),
);
campusRouter.get(
  "/erp/system-fields",
  requireAnyPermission("erp.view", "settings.view"),
  asyncHandler(getSystemFieldsSetupController),
);
campusRouter.put(
  "/erp/system-fields/:key",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(upsertSystemFieldController),
);
campusRouter.get(
  "/erp/shortcut-keys",
  requireAnyPermission("erp.view", "settings.view"),
  asyncHandler(getShortcutKeysSetupController),
);
campusRouter.put(
  "/erp/shortcut-keys",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(saveShortcutKeysController),
);
campusRouter.post(
  "/erp/shortcut-keys/reset",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(resetShortcutKeysController),
);
campusRouter.get(
  "/erp/theme-branding",
  requireAnyPermission("erp.view", "settings.view"),
  asyncHandler(getThemeBrandingSetupController),
);
campusRouter.put(
  "/erp/theme-branding",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(saveThemeBrandingController),
);
campusRouter.get(
  "/erp/website-cms",
  requireAnyPermission("erp.view", "settings.view"),
  asyncHandler(getWebsiteCmsSetupController),
);
campusRouter.post(
  "/erp/website-cms/pages",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(createWebsitePageController),
);
campusRouter.put(
  "/erp/website-cms/pages/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(updateWebsitePageController),
);
campusRouter.delete(
  "/erp/website-cms/pages/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteWebsitePageController),
);
campusRouter.post(
  "/erp/website-cms/menus",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertWebsiteMenuController),
);
campusRouter.delete(
  "/erp/website-cms/menus/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteWebsiteMenuController),
);
campusRouter.post(
  "/erp/website-cms/menu-items",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertWebsiteMenuItemController),
);
campusRouter.delete(
  "/erp/website-cms/menu-items/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteWebsiteMenuItemController),
);
campusRouter.post(
  "/erp/website-cms/media",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(createWebsiteMediaController),
);
campusRouter.delete(
  "/erp/website-cms/media/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteWebsiteMediaController),
);
campusRouter.post(
  "/erp/website-cms/banners",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertWebsiteBannerController),
);
campusRouter.delete(
  "/erp/website-cms/banners/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteWebsiteBannerController),
);
campusRouter.put(
  "/erp/website-cms/site-settings",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(saveWebsiteSiteSettingsController),
);
campusRouter.get(
  "/erp/sms-gateway",
  requireAnyPermission("erp.view", "settings.view"),
  asyncHandler(getSmsGatewaySetupController),
);
campusRouter.put(
  "/erp/sms-gateway",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(saveSmsGatewayController),
);
campusRouter.post(
  "/erp/sms-gateway/test",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(testSmsGatewayController),
);
campusRouter.post(
  "/erp/sms-gateway/templates",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertSmsTemplateController),
);
campusRouter.post(
  "/erp/sms-gateway/templates/:id/clone",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(cloneSmsTemplateController),
);
campusRouter.delete(
  "/erp/sms-gateway/templates/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteSmsTemplateController),
);
campusRouter.get(
  "/erp/email-gateway",
  requireAnyPermission("erp.view", "settings.view"),
  asyncHandler(getEmailGatewaySetupController),
);
campusRouter.post(
  "/erp/email-gateway",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertEmailGatewayController),
);
campusRouter.post(
  "/erp/email-gateway/test",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(testEmailGatewayController),
);
campusRouter.post(
  "/erp/email-gateway/templates",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertEmailTemplateController),
);
campusRouter.delete(
  "/erp/email-gateway/templates/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteEmailTemplateController),
);
campusRouter.post(
  "/erp/email-gateway/:id/clone",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(cloneEmailGatewayController),
);
campusRouter.delete(
  "/erp/email-gateway/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteEmailGatewayController),
);
campusRouter.get(
  "/erp/whatsapp-gateway",
  requireAnyPermission("erp.view", "settings.view"),
  asyncHandler(getWhatsAppGatewaySetupController),
);
campusRouter.put(
  "/erp/whatsapp-gateway",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(saveWhatsAppGatewayController),
);
campusRouter.post(
  "/erp/whatsapp-gateway/test",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(testWhatsAppConnectionController),
);
campusRouter.post(
  "/erp/whatsapp-gateway/test-message",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(sendWhatsAppTestMessageController),
);
campusRouter.post(
  "/erp/whatsapp-gateway/templates",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertWhatsAppTemplateController),
);
campusRouter.delete(
  "/erp/whatsapp-gateway/templates/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteWhatsAppTemplateController),
);
campusRouter.get(
  "/erp/push-gateway",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(getPushGatewaySetupController),
);
campusRouter.put(
  "/erp/push-gateway",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(savePushGatewayController),
);
campusRouter.post(
  "/erp/push-gateway/test",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(testPushGatewayController),
);
campusRouter.post(
  "/erp/push-gateway/topics",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertPushTopicController),
);
campusRouter.delete(
  "/erp/push-gateway/topics/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deletePushTopicController),
);
campusRouter.get(
  "/erp/notification-triggers",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(getNotificationTriggersSetupController),
);
campusRouter.post(
  "/erp/notification-triggers",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertNotificationTriggerController),
);
campusRouter.post(
  "/erp/notification-triggers/:id/toggle",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(toggleNotificationTriggerController),
);
campusRouter.post(
  "/erp/notification-triggers/:id/test",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(testNotificationTriggerController),
);
campusRouter.delete(
  "/erp/notification-triggers/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteNotificationTriggerController),
);
campusRouter.get(
  "/erp/message-notice-templates",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(getMessageNoticeTemplatesSetupController),
);
campusRouter.post(
  "/erp/message-notice-templates",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(upsertMessageNoticeTemplateController),
);
campusRouter.post(
  "/erp/message-notice-templates/:id/toggle",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(toggleMessageNoticeTemplateController),
);
campusRouter.delete(
  "/erp/message-notice-templates/:id",
  requireAnyPermission("erp.manage", "settings.manage"),
  asyncHandler(deleteMessageNoticeTemplateController),
);
campusRouter.put(
  "/erp/shortcuts/:key",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(upsertShortcutController),
);
campusRouter.put(
  "/erp/profile-rights/:key",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(upsertProfileRightController),
);
campusRouter.post(
  "/erp/holidays",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(createHolidayController),
);
campusRouter.delete(
  "/erp/holidays/:id",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(deleteHolidayController),
);
campusRouter.get(
  "/erp/student-docs-folders",
  requireAnyPermission("erp.view", "settings.view", "documents.view", "students.view"),
  asyncHandler(getStudentDocsFoldersSetupController),
);
campusRouter.post(
  "/erp/student-docs-folders",
  requireAnyPermission("erp.manage", "settings.manage", "documents.manage", "students.manage"),
  asyncHandler(createStudentDocsFolderController),
);
campusRouter.put(
  "/erp/student-docs-folders/reorder",
  requireAnyPermission("erp.manage", "settings.manage", "documents.manage", "students.manage"),
  asyncHandler(reorderStudentDocsFoldersController),
);
campusRouter.put(
  "/erp/student-docs-folders/:id",
  requireAnyPermission("erp.manage", "settings.manage", "documents.manage", "students.manage"),
  asyncHandler(updateStudentDocsFolderController),
);
campusRouter.delete(
  "/erp/student-docs-folders/:id",
  requireAnyPermission("erp.manage", "settings.manage", "documents.manage", "students.manage"),
  asyncHandler(deleteStudentDocsFolderController),
);
campusRouter.post(
  "/erp/student-docs-folders/:id/restore",
  requireAnyPermission("erp.manage", "settings.manage", "documents.manage", "students.manage"),
  asyncHandler(restoreStudentDocsFolderController),
);
campusRouter.post(
  "/erp/document-folders",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(createDocumentFolderController),
);
campusRouter.post(
  "/erp/student-documents",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(createStudentDocumentController),
);
campusRouter.delete(
  "/erp/student-documents/:id",
  requireEntitlement("CMS"),
  requirePermission("erp.manage"),
  asyncHandler(deleteStudentDocumentController),
);
campusRouter.post(
  "/erp/backups",
  requireEntitlement("CMS"),
  requirePermission("erp.backup"),
  asyncHandler(createConfigurationBackupController),
);
campusRouter.post(
  "/erp/backups/:id/restore",
  requireEntitlement("CMS"),
  requirePermission("erp.backup"),
  asyncHandler(restoreConfigurationBackupController),
);
campusRouter.get(
  "/erp/backup-restore",
  requireAnyPermission("erp.manage", "settings.manage", "erp.backup", "erp.view"),
  asyncHandler(getBackupRestoreSetupController),
);
campusRouter.post(
  "/erp/backup-restore/backups",
  requireAnyPermission("erp.manage", "settings.manage", "erp.backup"),
  asyncHandler(createSystemBackupController),
);
campusRouter.delete(
  "/erp/backup-restore/backups/:id",
  requireAnyPermission("erp.manage", "settings.manage", "erp.backup"),
  asyncHandler(deleteSystemBackupController),
);
campusRouter.post(
  "/erp/backup-restore/backups/:id/restore",
  requireAnyPermission("erp.manage", "settings.manage", "erp.backup"),
  asyncHandler(restoreSystemBackupController),
);
campusRouter.put(
  "/erp/backup-restore/settings",
  requireAnyPermission("erp.manage", "settings.manage", "erp.backup"),
  asyncHandler(saveBackupSettingsController),
);
campusRouter.post(
  "/erp/backup-restore/schedules",
  requireAnyPermission("erp.manage", "settings.manage", "erp.backup"),
  asyncHandler(upsertBackupScheduleController),
);
campusRouter.delete(
  "/erp/backup-restore/schedules/:id",
  requireAnyPermission("erp.manage", "settings.manage", "erp.backup"),
  asyncHandler(deleteBackupScheduleController),
);

export { campusRouter };