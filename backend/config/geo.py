from decimal import Decimal

from django.conf import settings


EARTH_METERS_PER_DEGREE = Decimal("111111")


def database_supports_postgis() -> bool:
    return getattr(settings, "DATABASE_BACKEND", "sqlite") == "postgis"


def radius_to_degrees(radius_meters: int | float | Decimal) -> Decimal:
    return Decimal(str(radius_meters)) / EARTH_METERS_PER_DEGREE


def coordinates_within_radius(lat_a, lon_a, lat_b, lon_b, radius_meters: int | float) -> bool:
    if lat_a is None or lon_a is None or lat_b is None or lon_b is None:
        return False
    radius_degrees = float(radius_to_degrees(radius_meters))
    lat_delta = abs(float(lat_a) - float(lat_b))
    lon_delta = abs(float(lon_a) - float(lon_b))
    return lat_delta <= radius_degrees and lon_delta <= radius_degrees


def point_payload(latitude, longitude) -> dict | None:
    if latitude is None or longitude is None:
        return None
    return {
        "type": "Point",
        "coordinates": [float(longitude), float(latitude)],
    }


NIGERIA_STATE_HUBS = [
    {"label": "Lagos", "state": "Lagos", "latitude": 6.5244, "longitude": 3.3792},
    {"label": "Ibadan", "state": "Oyo", "latitude": 7.3775, "longitude": 3.947},
    {"label": "Abeokuta", "state": "Ogun", "latitude": 7.1569, "longitude": 3.3451},
    {"label": "Benin City", "state": "Edo", "latitude": 6.335, "longitude": 5.6037},
    {"label": "Port Harcourt", "state": "Rivers", "latitude": 4.8156, "longitude": 7.0498},
    {"label": "Enugu", "state": "Enugu", "latitude": 6.4584, "longitude": 7.5464},
    {"label": "Abuja", "state": "FCT", "latitude": 9.0579, "longitude": 7.4951},
    {"label": "Kaduna", "state": "Kaduna", "latitude": 10.5222, "longitude": 7.4384},
    {"label": "Kano", "state": "Kano", "latitude": 12.0022, "longitude": 8.592},
    {"label": "Jos", "state": "Plateau", "latitude": 9.8965, "longitude": 8.8583},
    {"label": "Maiduguri", "state": "Borno", "latitude": 11.8311, "longitude": 13.1509},
    {"label": "Calabar", "state": "Cross River", "latitude": 4.9757, "longitude": 8.3417},
]


def _haversine_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    import math

    earth_radius_km = 6371
    d_lat = math.radians(lat_b - lat_a)
    d_lon = math.radians(lon_b - lon_a)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat_a))
        * math.cos(math.radians(lat_b))
        * math.sin(d_lon / 2) ** 2
    )
    return 2 * earth_radius_km * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def resolve_nigeria_state(latitude: float | int | Decimal | None, longitude: float | int | Decimal | None) -> dict:
    if latitude is None or longitude is None:
        return {"label": "", "state": "", "latitude": None, "longitude": None}

    lat = float(latitude)
    lon = float(longitude)
    best = min(
        NIGERIA_STATE_HUBS,
        key=lambda hub: _haversine_km(lat, lon, hub["latitude"], hub["longitude"]),
    )
    return {
        "label": best["label"],
        "state": best["state"],
        "latitude": best["latitude"],
        "longitude": best["longitude"],
    }


def alert_location_payload(*, label: str = "", latitude=None, longitude=None, state: str = "") -> dict:
    payload = {
        "location_name": label,
        "location_state": state,
        "location_latitude": latitude,
        "location_longitude": longitude,
    }
    return payload
