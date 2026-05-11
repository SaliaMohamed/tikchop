import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: Number(__ENV.K6_VUS || 3),
  duration: __ENV.K6_DURATION || "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2500"],
  },
};

const baseUrl = (__ENV.QA_BASE_URL || "https://dashboard-l3negw2oa-saliamohamed05-8715s-projects.vercel.app").replace(/\/+$/, "");

export default function publicSmoke() {
  const routes = ["/onboarding", "/login", "/conditions", "/confidentialite"];

  for (const route of routes) {
    const response = http.get(`${baseUrl}${route}`);
    check(response, {
      [`${route} status 200`]: (res) => res.status === 200,
      [`${route} html`]: (res) => String(res.headers["Content-Type"] || "").includes("text/html"),
    });
    sleep(0.4);
  }
}
