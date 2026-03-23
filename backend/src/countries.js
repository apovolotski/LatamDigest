import fs from "node:fs";
import path from "node:path";

const countriesPath = path.resolve(
  process.cwd(),
  "../LatamDigest/Resources/Countries.json"
);

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
