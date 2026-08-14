import type {
  LessonPlan,
  LiveClass,
  NcertResource,
  ProductMode,
  Question,
  TestSeries,
  TestSeriesPaper,
  TenantType,
} from "@prisma/client";

export interface AuthContext {
  userId: string;
  tenantId: string | null;
  resellerId: string | null;
  tenantType: TenantType | null;
  productMode: ProductMode | null;
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      /** Loaded by question-bank modify middleware for downstream handlers. */
      question?: Question;
      /** Loaded by test-series modify middleware. */
      testSeries?: TestSeries;
      testSeriesPaper?: TestSeriesPaper & {
        series?: { id: string; createdById: string; status: string };
      };
      /** Loaded by lesson-planning modify middleware. */
      lessonPlan?: LessonPlan;
      /** Loaded by live-classes modify middleware. */
      liveClass?: LiveClass;
      /** Loaded by ncert-content modify middleware. */
      ncertResource?: NcertResource;
    }
  }
}

export {};
