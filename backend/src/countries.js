import fs from "node:fs";
import { fileURLToPath } from "node:url";

const countriesPath = fileURLToPath(new URL("../../LatamDigest/Resources/Countries.json", import.meta.url));

export const countries = JSON.parse(fs.readFileSync(countriesPath, "utf8"));

export function isSupportedCountry(countryCode) {
  return countries.some((country) => country.id === countryCode.toUpperCase());
}

export function getCountryName(countryCode) {
  return (
    countries.find((country) => country.id === countryCode.toUpperCase())?.name ||
    countryCode.toUpperCase()
  );
}
