# API image. Build from the api/ folder:  docker build -t pinball-api .
# Configuration comes from the environment, e.g. ConnectionStrings__Pinball, Auth__Authority, Auth__ClientId.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first, from project files only, so code changes don't invalidate the package layer.
COPY Pinball.slnx ./
COPY src/Pinball.Api/Pinball.Api.csproj src/Pinball.Api/
COPY src/Pinball.SharedKernel/Pinball.SharedKernel.csproj src/Pinball.SharedKernel/
COPY src/Modules/Catalog/Pinball.Modules.Catalog/Pinball.Modules.Catalog.csproj src/Modules/Catalog/Pinball.Modules.Catalog/
COPY src/Modules/Sessions/Pinball.Modules.Sessions/Pinball.Modules.Sessions.csproj src/Modules/Sessions/Pinball.Modules.Sessions/
RUN dotnet restore src/Pinball.Api/Pinball.Api.csproj

COPY src/ src/
RUN dotnet publish src/Pinball.Api/Pinball.Api.csproj --configuration Release --no-restore --output /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# The base image's non-root user; the API listens on 8080 (ASPNETCORE_HTTP_PORTS).
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Pinball.Api.dll"]
