# Deploy the backend on a container host (e.g. Render).
FROM eclipse-temurin:27-jdk AS build
WORKDIR /app
COPY . .
RUN chmod +x ./mvnw && ./mvnw -DskipTests package

FROM eclipse-temurin:27-jre
WORKDIR /app
COPY --from=build /app/target/shuttle-backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
