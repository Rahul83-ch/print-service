# Multi-stage container compilation for Clean Architecture .NET 8 Worker Service
# Stage 1: Build & Restore Environment Using Official Microsoft .NET SDK
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy solution file and decentralized project manifests to leverage layer cache boundaries
COPY UniversalPrint.Agent.sln ./
COPY src/Agent.Domain/Agent.Domain.csproj src/Agent.Domain/
COPY src/Agent.Application/Agent.Application.csproj src/Agent.Application/
COPY src/Agent.Infrastructure/Agent.Infrastructure.csproj src/Agent.Infrastructure/
COPY src/Agent.Worker/Agent.Worker.csproj src/Agent.Worker/

# Execute atomic NuGet resolution sequence
RUN dotnet restore

# Pull in remain codebases
COPY src/ src/

# Build and compile under target Release structures
RUN dotnet publish src/Agent.Worker/Agent.Worker.csproj -c Release -o /app/publish

# Stage 2: Production-hardened Runtime Stage
# Using lightweight runtime image inside a non-privileged Linux setup
FROM mcr.microsoft.com/dotnet/runtime:8.0 AS final
WORKDIR /app

# Copy compiled resources over
COPY --from=build /app/publish .

# Standard non-root user setup for secure execution in multi-tenant environments
USER 1000

# Specify execution entrypoint
ENTRYPOINT ["dotnet", "Agent.Worker.dll"]