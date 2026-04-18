package com.los;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LosApplication {

    public static void main(String[] args) {
        SpringApplication.run(LosApplication.class, args);
    }
}
