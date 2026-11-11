# Self-hosted routing (OSRM)

Used for distance, geometry and drive-time estimates at quote time. The customer-facing
ETA should come from a traffic-aware provider (TomTom or Google Directions); OSRM alone
assumes free-flow speeds and will be optimistic in Accra traffic.

## Prepare the Ghana extract

```bash
mkdir -p infra/osrm-data
cd infra/osrm-data

curl -O https://download.geofabrik.de/africa/ghana-latest.osm.pbf

docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/ghana-latest.osm.pbf
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-partition /data/ghana-latest.osrm
docker run -t -v "$PWD:/data" osrm/osrm-backend osrm-customize /data/ghana-latest.osrm
```

## Run

```bash
docker run -d --name digio-osrm -p 5000:5000 \
  -v "$PWD/infra/osrm-data:/data" \
  osrm/osrm-backend osrm-routed --algorithm mld /data/ghana-latest.osrm
```

Verify:

```bash
curl "http://localhost:5000/route/v1/driving/-0.1668,5.6052;-0.1597,5.6357?overview=false"
```

## Notes

- Keep the `.osrm` artefacts out of git; regenerate quarterly or when OSM data drifts.
- Add Ghana's neighbours (Togo, Côte d'Ivoire, Burkina Faso) if cross-border trips are sold.
- The backend should call OSRM through `integrations/osrm` only, never directly from a controller.
