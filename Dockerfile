FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY GameOfLife.sln .
COPY src/GameOfLife.Web/GameOfLife.Web.csproj src/GameOfLife.Web/
COPY tests/GameOfLife.Tests/GameOfLife.Tests.csproj tests/GameOfLife.Tests/
RUN dotnet restore

COPY . .
RUN dotnet publish src/GameOfLife.Web/GameOfLife.Web.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN mkdir -p /app/data

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ConnectionStrings__DefaultConnection="Data Source=/app/data/gameoflife.db"

EXPOSE 8080

ENTRYPOINT ["dotnet", "GameOfLife.Web.dll"]
