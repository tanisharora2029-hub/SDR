import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INDUSTRIES } from "@ai-sdr/shared";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { validateBody } from "../middleware/validator.js";
import { RegisterSchema } from "@ai-sdr/shared";
import { organizationRouter } from "../routes/organization.routes.js";

const app = express();
app.use(express.json());
app.use("/organization", organizationRouter);
app.post("/registration-input", validateBody(RegisterSchema), (req, res) => res.json(req.body));

const configuration = {
  location: "Pune, Maharashtra",
  serviceAreas: "Baner, Aundh",
  businessHours: "Tuesday–Sunday, 10:00–19:00 IST",
  qualificationQuestions: INDUSTRIES.SALON.qualificationQuestions.join("\n"),
  aiInstructions: "Ask about the event date.",
  communicationPreferences: "Ask before following up."
};

const ids = [randomUUID(), randomUUID()];
const authorize = (organizationId: string) =>
  `Bearer ${signToken({ userId: randomUUID(), organizationId, email: "owner@example.com", role: "OWNER" })}`;

describe("Workspace business configuration", () => {
  beforeAll(async () => {
    for (const id of ids) {
      await prisma.organization.create({ data: { id, name: "Configuration test" } });
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
  });

  it("stores configuration with business details and isolates each workspace", async () => {
    const [salonId, realEstateId] = ids;
    await request(app).put("/organization").set("Authorization", authorize(salonId))
      .send({ industry: "SALON", pricingInfo: "Haircut ₹600", configuration }).expect(200);
    await request(app).put("/organization").set("Authorization", authorize(realEstateId))
      .send({ industry: "REAL_ESTATE" }).expect(200);

    const salon = await request(app).get("/organization").set("Authorization", authorize(salonId)).expect(200);
    expect(salon.body.configuration).toEqual(configuration);
    expect(salon.body.organization).toMatchObject({ industry: "SALON", pricingInfo: "Haircut ₹600" });

    const realEstate = await request(app).get("/organization").set("Authorization", authorize(realEstateId)).expect(200);
    expect(realEstate.body.configuration).toBeNull();
    expect(realEstate.body.organization.industry).toBe("REAL_ESTATE");
  });

  it("requires authentication and validates configuration", async () => {
    await request(app).get("/organization").expect(401);
    await request(app).put("/organization").set("Authorization", authorize(ids[0]))
      .send({ configuration: { ...configuration, businessHours: 24 } }).expect(400);
  });

  it("accepts both launch industries while supporting existing registration clients", async () => {
    const registration = { name: "New Owner", organizationName: "Local Business", email: "owner@example.com", password: "password" };
    await request(app).post("/registration-input").send({ ...registration, industry: "SALON" }).expect(200);
    await request(app).post("/registration-input").send({ ...registration, industry: "REAL_ESTATE" }).expect(200);
    await request(app).post("/registration-input").send(registration).expect(200);
    await request(app).post("/registration-input").send({ ...registration, industry: "UNKNOWN" }).expect(400);
  });
});
