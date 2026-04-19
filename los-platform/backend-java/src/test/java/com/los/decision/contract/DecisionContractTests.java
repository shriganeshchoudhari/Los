package com.los.decision.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class DecisionContractTests {

    @Autowired
    private MockMvc mvc;

    @Test
    void triggerDecisionAcceptsAliasContextData() throws Exception {
        String payload = "{\"applicationId\": \"app-1\", \"forceRerun\": true, \"contextData\": \"ctx\"}";
        mvc.perform(post("/api/decisions/trigger").contentType("application/json").content(payload))
                .andExpect(status().isOk());
    }

    @Test
    void manualOverrideAcceptsFinalDecision() throws Exception {
        String payload = "{\"applicationId\": \"app-1\", \"finalDecision\": \"APPROVE\", \"rejectionReasonCode\": \"OTHER\", \"remarks\": \"ok\"}";
        mvc.perform(post("/api/decisions/override").contentType("application/json").content(payload))
                .andExpect(status().isOk());
    }

    @Test
    void endToEndDecisionFlowCanonical() throws Exception {
        String post = "{\"applicationId\": \"app-1\", \"forceRerun\": false, \"contextData\": \"ctx\"}";
        mvc.perform(post("/api/decisions/trigger").contentType("application/json").content(post))
                .andExpect(status().isOk());
        mvc.perform(get("/api/decisions/app-1")).andExpect(status().isOk());
    }
}
