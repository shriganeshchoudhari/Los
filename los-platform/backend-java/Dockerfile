# Multi-stage Maven build for LOS Platform Spring Boot
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Copy pom.xml and download dependencies first (layer caching)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S los && adduser -S los -G los

# Copy the JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Copy JWT keys (mounted from host)
COPY --from=builder /app/../backend/keys /keys

# Set ownership
RUN chown -R los:los /app /keys

USER los

EXPOSE 8080

# JVM tuning for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
