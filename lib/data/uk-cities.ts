export type UKCity = {
  name: string
  region: "England" | "Scotland" | "Wales" | "Northern Ireland"
  latitude: number
  longitude: number
  zoom: number
}

export const UK_CITIES: UKCity[] = [
  // England
  { name: "London", region: "England", latitude: 51.5074, longitude: -0.1278, zoom: 11 },
  { name: "Manchester", region: "England", latitude: 53.4808, longitude: -2.2426, zoom: 12 },
  { name: "Birmingham", region: "England", latitude: 52.4862, longitude: -1.8904, zoom: 12 },
  { name: "Leeds", region: "England", latitude: 53.8008, longitude: -1.5491, zoom: 12 },
  { name: "Liverpool", region: "England", latitude: 53.4084, longitude: -2.9916, zoom: 12 },
  { name: "Newcastle", region: "England", latitude: 54.9783, longitude: -1.6178, zoom: 12 },
  { name: "Sheffield", region: "England", latitude: 53.3811, longitude: -1.4701, zoom: 12 },
  { name: "Bristol", region: "England", latitude: 51.4545, longitude: -2.5879, zoom: 12 },
  { name: "Nottingham", region: "England", latitude: 52.9548, longitude: -1.1581, zoom: 12 },
  { name: "Leicester", region: "England", latitude: 52.6369, longitude: -1.1398, zoom: 12 },
  { name: "Coventry", region: "England", latitude: 52.4068, longitude: -1.5197, zoom: 12 },
  { name: "Bradford", region: "England", latitude: 53.7960, longitude: -1.7594, zoom: 12 },
  { name: "Southampton", region: "England", latitude: 50.9097, longitude: -1.4044, zoom: 12 },
  { name: "Portsmouth", region: "England", latitude: 50.8198, longitude: -1.0880, zoom: 12 },
  { name: "Plymouth", region: "England", latitude: 50.3755, longitude: -4.1427, zoom: 12 },
  { name: "Reading", region: "England", latitude: 51.4543, longitude: -0.9781, zoom: 12 },
  { name: "Oxford", region: "England", latitude: 51.7520, longitude: -1.2577, zoom: 13 },
  { name: "Cambridge", region: "England", latitude: 52.2053, longitude: 0.1218, zoom: 13 },
  { name: "Brighton", region: "England", latitude: 50.8225, longitude: -0.1372, zoom: 12 },
  { name: "York", region: "England", latitude: 53.9600, longitude: -1.0873, zoom: 13 },

  // Scotland
  { name: "Edinburgh", region: "Scotland", latitude: 55.9533, longitude: -3.1883, zoom: 12 },
  { name: "Glasgow", region: "Scotland", latitude: 55.8642, longitude: -4.2518, zoom: 12 },
  { name: "Aberdeen", region: "Scotland", latitude: 57.1497, longitude: -2.0943, zoom: 12 },
  { name: "Dundee", region: "Scotland", latitude: 56.4620, longitude: -2.9707, zoom: 12 },

  // Wales
  { name: "Cardiff", region: "Wales", latitude: 51.4816, longitude: -3.1791, zoom: 12 },
  { name: "Swansea", region: "Wales", latitude: 51.6214, longitude: -3.9436, zoom: 12 },
  { name: "Newport", region: "Wales", latitude: 51.5842, longitude: -2.9977, zoom: 12 },

  // Northern Ireland
  { name: "Belfast", region: "Northern Ireland", latitude: 54.5973, longitude: -5.9301, zoom: 12 },
  { name: "Derry", region: "Northern Ireland", latitude: 54.9966, longitude: -7.3086, zoom: 12 },
  { name: "Lisburn", region: "Northern Ireland", latitude: 54.5162, longitude: -6.0580, zoom: 13 },
  { name: "Newry", region: "Northern Ireland", latitude: 54.1751, longitude: -6.3402, zoom: 13 },
]

export const ALL_CITIES_OPTION: UKCity = {
  name: "All Cities",
  region: "England",
  latitude: 54.0,
  longitude: -2.0,
  zoom: 6,
}

export const DEFAULT_CITY = ALL_CITIES_OPTION

export const CITIES_BY_REGION = UK_CITIES.reduce(
  (acc, city) => {
    if (!acc[city.region]) {
      acc[city.region] = []
    }
    acc[city.region].push(city)
    return acc
  },
  {} as Record<string, UKCity[]>
)
