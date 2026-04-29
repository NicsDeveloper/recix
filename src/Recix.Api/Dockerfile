FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["src/Recix.Api/Recix.Api.csproj", "src/Recix.Api/"]
COPY ["src/Recix.Application/Recix.Application.csproj", "src/Recix.Application/"]
COPY ["src/Recix.Domain/Recix.Domain.csproj", "src/Recix.Domain/"]
COPY ["src/Recix.Infrastructure/Recix.Infrastructure.csproj", "src/Recix.Infrastructure/"]

RUN dotnet restore "src/Recix.Api/Recix.Api.csproj"

COPY . .

RUN dotnet publish "src/Recix.Api/Recix.Api.csproj" \
    -c Release \
    -o /app/publish \
    --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Recix.Api.dll"]
