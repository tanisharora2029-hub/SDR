export const INDUSTRY_IDS = ["REAL_ESTATE", "SALON", "OTHER"] as const;
export type IndustryId = (typeof INDUSTRY_IDS)[number];

export const INDUSTRIES = {
  REAL_ESTATE: {
    label: "Real Estate",
    services: ["Residential property", "Commercial property", "Buying", "Selling", "Renting", "Property investment", "Site visits"],
    qualificationQuestions: [
      "Are you looking to buy, sell, rent, or invest?",
      "What property type and localities are you considering?",
      "What budget, number of bedrooms or floor area, and timeline work for you?",
      "Would you like a site visit or help discussing financing with an advisor?"
    ]
  },
  SALON: {
    label: "Salon and Beauty",
    services: ["Hair services", "Beauty treatments", "Bridal makeup", "Skin services", "Appointments", "Service recommendations"],
    qualificationQuestions: [
      "Which service or occasion are you preparing for?",
      "What appointment date, time, and location would work for you?",
      "Is there an event date or budget you would like us to keep in mind?"
    ]
  },
  OTHER: { label: "Other businesses", services: [], qualificationQuestions: [] }
} satisfies Record<IndustryId, { label: string; services: string[]; qualificationQuestions: string[] }>;
