# Multi-stage build for LOS Platform Spring Boot Monolith
# Stage 1: Build
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder

WORKDIR /app

# Copy pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build the application - skip tests for docker build
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S los && adduser -S los -G los

# Copy the JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Expose backend port
EXPOSE 8082

# JVM tuning for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError"

# Set ownership
RUN chown -R los:los /app

USER los

# Entrypoint runs the JAR
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
