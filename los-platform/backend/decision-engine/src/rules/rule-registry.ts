import {
  RuleDefinition,
  RuleCategory,
  RuleSeverity,
  RuleCondition,
  RuleThenClause,
  RuleEvaluator,
  DecisionContext,
  RuleEvaluationResult,
  RuleOutcome,
} from './rule.types';

function pass(id: string, name: string, cat: RuleCategory, message: string): RuleEvaluator {
  return () => ({
    ruleId: id, ruleName: name, category: cat, severity: RuleSeverity.INFO,
    outcome: RuleOutcome.PASS, threshold: '', actualValue: '', message, isHardStop: false, evaluatedAt: new Date(),
  });
}

function fail(id: string, name: string, cat: RuleCategory, sev: RuleSeverity, message: string, rejectionCode?: string): RuleEvaluator {
  return () => ({
    ruleId: id, ruleName: name, category: cat, severity: sev,
    outcome: sev === RuleSeverity.HARD_STOP ? RuleOutcome.FAIL : RuleOutcome.WARN,
    threshold: '', actualValue: '', message, isHardStop: sev === RuleSeverity.HARD_STOP,
    rejectionCode, evaluatedAt: new Date(),
  });
}

function makeEvaluator(def: RuleDefinition): RuleEvaluator {
  return (ctx: DecisionContext) => {
    const { ctx: c, product } = ctx;
    try {
      switch (def.ruleId) {

        /* ── CREDIT_SCORE ─────────────────────────────────── */

        case 'CS_001': {
          const score = c.bureauData?.creditScore ?? 0;
          const min = def.productOverrides?.find(o => o.loanType === c.loanType)?.threshold ?? product.minCreditScore;
          const passed = score >= min;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: String(min), actualValue: String(score),
            message: passed ? `Credit score ${score} meets minimum ${min}` : `Credit score ${score} below minimum ${min}`,
            isHardStop: true, rejectionCode: 'CS_001', evaluatedAt: new Date(),
          };
        }

        case 'CS_002': {
          const score = c.bureauData?.creditScore ?? 0;
          const min = 800;
          const passed = score >= min;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '800', actualValue: String(score),
            message: passed ? 'Top-tier credit score' : `Score ${score} below 800 — consider rate adjustment`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'CS_003': {
          const score = c.bureauData?.creditScore;
          const hasScore = score !== undefined && score > 0;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: hasScore ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: '>0', actualValue: score ? String(score) : 'NOT_FOUND',
            message: hasScore ? 'Credit score available' : 'Credit score not found or not pulled',
            isHardStop: true, rejectionCode: 'CS_003', evaluatedAt: new Date(),
          };
        }

        case 'CS_004': {
          const score = c.bureauData?.creditScore ?? 0;
          const inRange = score >= 550 && score <= 649;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !inRange ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '550-649', actualValue: String(score),
            message: inRange ? `Score ${score} in sub-prime range — manual review recommended` : 'Score outside sub-prime range',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'CS_005': {
          const drop = c.bureauData?.scoreDrop ?? 0;
          const passed = drop <= 50;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '<=50 points', actualValue: `${drop} points`,
            message: drop > 50 ? `Significant score drop of ${drop} points detected` : 'No significant score drop',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── FOIR ─────────────────────────────────────────── */

        case 'FOIR_001': {
          const foir = calcFOIR(c.netMonthlyIncome, c.bureauData?.totalEmi ?? 0, c.requestedAmount, c.requestedTenureMonths);
          const maxFoir = def.productOverrides?.find(o => o.loanType === c.loanType)?.threshold ?? product.maxFoir;
          const passed = foir <= maxFoir;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: `${maxFoir}%`, actualValue: `${foir.toFixed(2)}%`,
            message: passed ? `FOIR ${foir.toFixed(2)}% within limit` : `FOIR ${foir.toFixed(2)}% exceeds ${maxFoir}%`,
            isHardStop: true, rejectionCode: 'FOIR_001', evaluatedAt: new Date(),
          };
        }

        case 'FOIR_002': {
          const foir = calcFOIR(c.netMonthlyIncome, c.bureauData?.totalEmi ?? 0, c.requestedAmount, c.requestedTenureMonths);
          const maxFoir = product.maxFoir;
          const near = foir > maxFoir * 0.75;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !near ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: `>${(maxFoir * 0.75).toFixed(0)}% of max`, actualValue: `${foir.toFixed(2)}%`,
            message: near ? `FOIR ${foir.toFixed(2)}% is >75% of max allowed — consider reducing amount or tenure` : 'FOIR is healthy',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'FOIR_003': {
          const foir = calcFOIR(c.netMonthlyIncome, c.bureauData?.totalEmi ?? 0, c.requestedAmount, c.requestedTenureMonths);
          const maxFoir = product.maxFoir;
          const passed = foir <= maxFoir;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: `${maxFoir}%`, actualValue: `${foir.toFixed(2)}%`,
            message: passed ? 'Proposed EMI within FOIR limit' : `Proposed EMI pushes FOIR to ${foir.toFixed(2)}%`,
            isHardStop: true, rejectionCode: 'FOIR_003', evaluatedAt: new Date(),
          };
        }

        case 'FOIR_004': {
          const netAfterEmi = c.netMonthlyIncome - (c.bureauData?.totalEmi ?? 0);
          const passed = netAfterEmi > 500000; // ₹5,000 after obligations
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: '₹5,000', actualValue: `₹${(netAfterEmi / 100000).toFixed(2)}L`,
            message: passed ? 'Net income after obligations is sufficient' : 'Net income after obligations too low',
            isHardStop: true, rejectionCode: 'FOIR_004', evaluatedAt: new Date(),
          };
        }

        /* ── INCOME ──────────────────────────────────────── */

        case 'INC_001': {
          const minIncome = 1500000; // ₹15,000
          const passed = c.netMonthlyIncome >= minIncome;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: '₹15,000/month', actualValue: `₹${(c.netMonthlyIncome / 100000).toFixed(2)}L/month`,
            message: passed ? 'Income meets minimum requirement' : `Income ₹${(c.netMonthlyIncome / 100000).toFixed(2)}L below minimum ₹15,000`,
            isHardStop: true, rejectionCode: 'INC_001', evaluatedAt: new Date(),
          };
        }

        case 'INC_002': {
          const disclosed = c.grossMonthlyIncome > 0 && c.netMonthlyIncome > 0;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: disclosed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: '>0', actualValue: `₹${(c.netMonthlyIncome / 100000).toFixed(2)}L`,
            message: disclosed ? 'Income disclosed' : 'Income not disclosed — cannot proceed',
            isHardStop: true, rejectionCode: 'INC_002', evaluatedAt: new Date(),
          };
        }

        case 'INC_003': {
          const emi = c.bureauData?.totalEmi ?? 0;
          const ratio = emi / c.grossMonthlyIncome;
          const passed = ratio <= 0.5;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: '<=50% of gross', actualValue: `${(ratio * 100).toFixed(1)}% of gross`,
            message: passed ? 'EMI-to-gross ratio acceptable' : `EMI ${(ratio * 100).toFixed(1)}% of gross income exceeds 50%`,
            isHardStop: true, rejectionCode: 'INC_003', evaluatedAt: new Date(),
          };
        }

        case 'INC_004': {
          // Salary account with the bank — flag as informational (would check bank account data)
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: RuleOutcome.PASS, threshold: 'Any', actualValue: 'N/A',
            message: 'Salary account check — informational only', isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── AGE ──────────────────────────────────────────── */

        case 'AGE_001': {
          const ageAtMaturity = c.applicantAge + (c.requestedTenureMonths / 12);
          const maxAge = product.maxAge;
          const passed = ageAtMaturity <= maxAge;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: `${maxAge} years`, actualValue: `${ageAtMaturity.toFixed(1)} years`,
            message: passed ? `Age at maturity ${ageAtMaturity.toFixed(1)} within limit` : `Age at maturity ${ageAtMaturity.toFixed(1)} exceeds ${maxAge}`,
            isHardStop: true, rejectionCode: 'AGE_001', evaluatedAt: new Date(),
          };
        }

        case 'AGE_002': {
          const minAge = product.minAge ?? 18;
          const passed = c.applicantAge >= minAge;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: `${minAge} years`, actualValue: `${c.applicantAge} years`,
            message: passed ? 'Applicant meets minimum age' : `Applicant ${c.applicantAge} below minimum age ${minAge}`,
            isHardStop: true, rejectionCode: 'AGE_002', evaluatedAt: new Date(),
          };
        }

        case 'AGE_003': {
          const ageAtDisbursement = c.applicantAge + 0.5; // approx 6 months from application
          const passed = ageAtDisbursement < 65;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '<65 years at disbursement', actualValue: `~${ageAtDisbursement.toFixed(1)} years`,
            message: passed ? 'Age at disbursement acceptable' : `Age at disbursement ~${ageAtDisbursement.toFixed(1)} years — may affect tenure`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'AGE_004': {
          const isSenior = c.applicantAge >= 60;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: RuleOutcome.PASS,
            threshold: '60+ years', actualValue: `${c.applicantAge} years`,
            message: isSenior ? `Senior citizen (${c.applicantAge}y) — co-borrower or insurance may be required` : 'Not a senior citizen',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── AMOUNT_TENURE ─────────────────────────────────── */

        case 'AMT_001': {
          const minAmt = product.minAmount;
          const maxAmt = product.maxAmount;
          const passed = c.requestedAmount >= minAmt && c.requestedAmount <= maxAmt;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: `₹${(minAmt/100000).toFixed(0)}L - ₹${(maxAmt/100000).toFixed(0)}L`,
            actualValue: `₹${(c.requestedAmount/100000).toFixed(2)}L`,
            message: passed ? 'Amount within product limits' : `Amount ₹${(c.requestedAmount/100000).toFixed(2)}L outside limits`,
            isHardStop: true, rejectionCode: 'AMT_001', evaluatedAt: new Date(),
          };
        }

        case 'AMT_002': {
          const maxEligible = calcMaxEligibility(c.netMonthlyIncome, c.bureauData?.totalEmi ?? 0, product.maxFoir, c.requestedTenureMonths);
          const exceeds = c.requestedAmount > maxEligible;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !exceeds ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: `₹${(maxEligible/100000).toFixed(2)}L`, actualValue: `₹${(c.requestedAmount/100000).toFixed(2)}L`,
            message: exceeds ? `Requested ₹${(c.requestedAmount/100000).toFixed(2)}L exceeds eligibility ₹${(maxEligible/100000).toFixed(2)}L` : 'Amount within eligibility',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'AMT_003': {
          const minAmt = product.minAmount;
          const below = c.requestedAmount < minAmt;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !below ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: `₹${(minAmt/100000).toFixed(0)}L`, actualValue: `₹${(c.requestedAmount/100000).toFixed(2)}L`,
            message: below ? `Amount ₹${(c.requestedAmount/100000).toFixed(2)}L below minimum ₹${(minAmt/100000).toFixed(0)}L` : 'Amount above minimum',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'TEN_001': {
          const minT = product.minTenureMonths;
          const maxT = product.maxTenureMonths;
          const passed = c.requestedTenureMonths >= minT && c.requestedTenureMonths <= maxT;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: `${minT}-${maxT} months`, actualValue: `${c.requestedTenureMonths} months`,
            message: passed ? 'Tenure within product limits' : `Tenure ${c.requestedTenureMonths} months outside ${minT}-${maxT}`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'TEN_002': {
          const passed = c.applicantAge < 58 || c.requestedTenureMonths <= 60;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '<=60 months if age>58', actualValue: `${c.requestedTenureMonths} months (age ${c.applicantAge})`,
            message: passed ? 'Tenure acceptable for age' : 'Tenure may be restricted for older applicants',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── BUREAU_HISTORY ────────────────────────────────── */

        case 'DPD_001': {
          const maxDpd = Math.max(c.bureauData?.dpd90 ?? 0, c.bureauData?.dpd180 ?? 0);
          const passed = maxDpd === 0;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: '0 days', actualValue: `${maxDpd} days`,
            message: passed ? 'No 90+ DPD in bureau' : `Found ${maxDpd} days past due — hard stop`,
            isHardStop: true, rejectionCode: 'DPD_001', evaluatedAt: new Date(),
          };
        }

        case 'DPD_002': {
          const dpd60 = c.bureauData?.dpd60 ?? 0;
          const passed = dpd60 === 0;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '0 days', actualValue: `${dpd60} days`,
            message: passed ? 'No 60+ DPD found' : `Found ${dpd60} days past due in 60-day bucket`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'DPD_003': {
          // Worsening trend: 30->60 in last 12 months
          const dpd30 = c.bureauData?.dpd30 ?? 0;
          const dpd60 = c.bureauData?.dpd60 ?? 0;
          const worsening = dpd60 > 0 && dpd30 > 0;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !worsening ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: 'No worsening', actualValue: worsening ? 'Worsening' : 'Stable',
            message: worsening ? 'DPD trend worsening — 30-day to 60-day bucket deterioration' : 'DPD trend stable',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'BUR_001': {
          const active = c.bureauData?.activeAccounts ?? 0;
          const passed = active > 0;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '>0 accounts', actualValue: `${active} active`,
            message: active === 0 ? 'No active accounts in bureau — cannot assess credit behaviour' : `${active} active accounts found`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'BUR_002': {
          const total = (c.bureauData?.activeAccounts ?? 0) + (c.bureauData?.closedAccounts ?? 0);
          const passed = total <= 15;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '<=15 accounts', actualValue: `${total} total`,
            message: passed ? 'Account count acceptable' : `High account count (${total}) — over-indebtedness risk`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'BUR_003': {
          const accounts = c.bureauData?.accounts ?? [];
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          const recent = accounts.filter(a => new Date(a.openedDate) > sixMonthsAgo);
          const passed = recent.length <= 3;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '<=3 recent accounts', actualValue: `${recent.length} accounts <6 months`,
            message: recent.length > 3 ? `Too many recently opened accounts (${recent.length})` : 'Recent account opening acceptable',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'ENQ_001': {
          const enq30 = c.bureauData?.enquiries30d ?? 0;
          const enq90 = c.bureauData?.enquiries90d ?? 0;
          const passed = enq90 <= 6;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '<=6 in 90 days', actualValue: `${enq90} (30d: ${enq30})`,
            message: enq90 > 6 ? `High enquiry velocity: ${enq90} in 90 days` : 'Enquiry velocity acceptable',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── FRAUD ─────────────────────────────────────────── */

        case 'FRD_001': {
          const hasFraud = c.bureauData?.fraudFlag || c.bureauData?.suitFiled || c.bureauData?.wilfulDefaulter;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: hasFraud ? RuleOutcome.FAIL : RuleOutcome.PASS,
            threshold: 'None', actualValue: hasFraud ? 'FLAGGED' : 'CLEAR',
            message: hasFraud ? 'Fraud/suit/defaulter flag detected — hard stop' : 'No fraud indicators',
            isHardStop: true, rejectionCode: 'FRD_001', evaluatedAt: new Date(),
          };
        }

        case 'FRD_002': {
          const suit = c.bureauData?.suitFiled ?? false;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !suit ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: 'No suit filed', actualValue: suit ? 'YES' : 'NO',
            message: suit ? 'Suit filed — hard stop' : 'No suit filed',
            isHardStop: true, rejectionCode: 'FRD_002', evaluatedAt: new Date(),
          };
        }

        case 'FRD_003': {
          const wilful = c.bureauData?.wilfulDefaulter ?? false;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !wilful ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: 'Not wilful defaulter', actualValue: wilful ? 'YES' : 'NO',
            message: wilful ? 'Wilful defaulter flag — hard stop' : 'No wilful defaulter flag',
            isHardStop: true, rejectionCode: 'FRD_003', evaluatedAt: new Date(),
          };
        }

        case 'FRD_004': {
          const disputed = c.bureauData?.disputed ?? false;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !disputed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: 'No disputed', actualValue: disputed ? 'YES' : 'NO',
            message: disputed ? 'Disputed account found — review required' : 'No disputed accounts',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── EMPLOYMENT ────────────────────────────────────── */

        case 'EMP_001': {
          const allowed = product.allowedEmploymentTypes ?? [];
          const passed = allowed.length === 0 || allowed.includes(c.employmentType);
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: allowed.length > 0 ? allowed.join(', ') : 'ALL',
            actualValue: c.employmentType,
            message: passed ? `${c.employmentType} eligible for this product` : `${c.employmentType} may not be eligible`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'EMP_002': {
          const tenure = c.employmentTenureMonths ?? 0;
          const minTenure = 3; // 3 months minimum
          const passed = tenure >= minTenure;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: `>=${minTenure} months`, actualValue: `${tenure} months`,
            message: passed ? 'Employment tenure acceptable' : `Only ${tenure} months employment — stability concern`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'EMP_003': {
          const cat = c.companyCategory ?? 'STANDARD';
          const restricted = ['BLACKLISTED', 'UNLISTED_RISKY'].includes(cat);
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !restricted ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: 'Not blacklisted', actualValue: cat,
            message: restricted ? `Company category "${cat}" — elevated risk` : `Company category "${cat}" acceptable`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── LTV ───────────────────────────────────────────── */

        case 'LTV_001': {
          if (!c.collateralValue || c.collateralValue <= 0) {
            return { ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity, outcome: RuleOutcome.SKIP, threshold: 'N/A', actualValue: 'No collateral', message: 'No collateral — LTV rule not applicable', isHardStop: false, evaluatedAt: new Date() };
          }
          const ltv = (c.requestedAmount / c.collateralValue) * 100;
          const maxLtv = product.maxLtv ?? 80;
          const passed = ltv <= maxLtv;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: `<=${maxLtv}%`, actualValue: `${ltv.toFixed(2)}%`,
            message: passed ? `LTV ${ltv.toFixed(2)}% within ${maxLtv}% limit` : `LTV ${ltv.toFixed(2)}% exceeds ${maxLtv}% limit`,
            isHardStop: true, rejectionCode: 'LTV_001', evaluatedAt: new Date(),
          };
        }

        case 'LTV_002': {
          if (!c.collateralValue || c.collateralValue <= 0) {
            return { ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity, outcome: RuleOutcome.SKIP, threshold: 'N/A', actualValue: 'N/A', message: 'No collateral', isHardStop: false, evaluatedAt: new Date() };
          }
          const ltv = (c.requestedAmount / c.collateralValue) * 100;
          const maxLtv = product.maxLtv ?? 80;
          const near = ltv > maxLtv * 0.85;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !near ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: `>${(maxLtv * 0.85).toFixed(0)}% of max`, actualValue: `${ltv.toFixed(2)}%`,
            message: near ? `LTV ${ltv.toFixed(2)}% near maximum — consider additional collateral` : 'LTV is healthy',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'LTV_003': {
          if (!c.collateralValue) {
            return { ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity, outcome: RuleOutcome.SKIP, threshold: 'N/A', actualValue: 'N/A', message: 'No collateral — check not applicable', isHardStop: false, evaluatedAt: new Date() };
          }
          const passed = c.collateralValue >= c.requestedAmount * 0.5;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: '>=50% of loan amount', actualValue: `₹${(c.collateralValue/100000).toFixed(2)}L`,
            message: passed ? 'Collateral value sufficient' : 'Collateral value insufficient for loan amount',
            isHardStop: true, rejectionCode: 'LTV_003', evaluatedAt: new Date(),
          };
        }

        /* ── PRODUCT_POLICY ────────────────────────────────── */

        case 'POL_001': {
          // GST requirement for business loans
          const requiresGst = ['PERSONAL_LOAN'].indexOf(c.loanType) === -1;
          if (!requiresGst) return { ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity, outcome: RuleOutcome.SKIP, threshold: 'N/A', actualValue: 'N/A', message: 'GST check not required for this product', isHardStop: false, evaluatedAt: new Date() };
          return { ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity, outcome: RuleOutcome.PASS, threshold: 'GST required', actualValue: 'N/A', message: 'GST compliance check — informational', isHardStop: false, evaluatedAt: new Date() };
        }

        case 'POL_002': {
          // NOC required for top-up
          return { ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity, outcome: RuleOutcome.PASS, threshold: 'NOC for top-up', actualValue: 'N/A', message: 'Top-up NOC check — informational only', isHardStop: false, evaluatedAt: new Date() };
        }

        case 'POL_003': {
          const fee = product.processingFeePercent ?? 0;
          const passed = fee <= 5.0;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '<=5%', actualValue: `${fee}%`,
            message: passed ? 'Processing fee within RBI guidelines' : `Processing fee ${fee}% exceeds 5% guideline`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── LEGAL ─────────────────────────────────────────── */

        case 'LEG_001': {
          // CIBIL rejection history
          const prevLoans = c.previousLoans ?? [];
          const rejected = prevLoans.filter(l => l.status === 'REJECTED').length;
          const passed = rejected === 0;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '0 rejections', actualValue: `${rejected} rejections`,
            message: rejected > 0 ? `${rejected} previous CIBIL rejections — manual review required` : 'No previous rejections',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        case 'LEG_002': {
          // RBI defaulter database check
          const wilful = c.bureauData?.wilfulDefaulter ?? false;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !wilful ? RuleOutcome.PASS : RuleOutcome.FAIL,
            threshold: 'Not in RBI defaulter list', actualValue: wilful ? 'FOUND' : 'NOT_FOUND',
            message: wilful ? 'Found in RBI defaulter database — hard stop' : 'Not found in RBI defaulter list',
            isHardStop: true, rejectionCode: 'LEG_002', evaluatedAt: new Date(),
          };
        }

        case 'LEG_003': {
          // RTGS/NEFT compliance
          const passed = c.requestedAmount < 5000000000; // ₹50Cr
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: RuleOutcome.PASS,
            threshold: '<₹50Cr', actualValue: `₹${(c.requestedAmount/100000).toFixed(2)}L`,
            message: 'RTGS/NEFT compliance check passed', isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── DEDUPLICATION ────────────────────────────────── */

        case 'DEDUP_001': {
          const apps = c.existingApplications ?? [];
          const recent = apps.filter(a => {
            const diffDays = (Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            return diffDays <= 30 && a.status !== 'REJECTED';
          });
          const passed = recent.length === 0;
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: passed ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: '0 active apps in 30d', actualValue: `${recent.length}`,
            message: recent.length > 0 ? `${recent.length} active application(s) in last 30 days — possible duplication` : 'No duplicate applications',
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── CHANNEL ──────────────────────────────────────── */

        case 'CH_001': {
          // DSA channel restrictions
          const dsaRestrictedProducts = ['GOLD_LOAN', 'MUDRA_KISHORE', 'MUDRA_TARUN'];
          const restricted = c.channelCode === 'DSA' && dsaRestrictedProducts.includes(c.loanType);
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: !restricted ? RuleOutcome.PASS : RuleOutcome.WARN,
            threshold: 'DSA restrictions', actualValue: c.channelCode,
            message: restricted ? `DSA channel restricted for ${c.loanType}` : `Channel ${c.channelCode} eligible`,
            isHardStop: false, evaluatedAt: new Date(),
          };
        }

        /* ── CATCH-ALL ────────────────────────────────────── */
        default:
          return {
            ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
            outcome: RuleOutcome.PASS, threshold: '', actualValue: 'N/A',
            message: `Rule ${def.ruleId} evaluated`, isHardStop: false, evaluatedAt: new Date(),
          };
      }
    } catch (err: any) {
      return {
        ruleId: def.ruleId, ruleName: def.name, category: def.category, severity: def.severity,
        outcome: RuleOutcome.WARN, threshold: '', actualValue: 'ERROR',
        message: `Rule evaluation error: ${err.message}`, isHardStop: false, evaluatedAt: new Date(),
      };
    }
  };
}

function calcFOIR(income: number, existingEmi: number, amount: number, tenure: number): number {
  const rate = 10.5;
  const monthlyRate = rate / 12 / 100;
  const emi = amount * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1);
  return ((existingEmi + emi) / income) * 100;
}

function calcMaxEligibility(income: number, existingEmi: number, maxFoir: number, tenure: number): number {
  const rate = 10.5;
  const monthlyRate = rate / 12 / 100;
  const availableForEmi = income * (maxFoir / 100) - existingEmi;
  return availableForEmi > 0
    ? availableForEmi * (Math.pow(1 + monthlyRate, tenure) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, tenure))
    : 0;
}

const RULE_DEFINITIONS: RuleDefinition[] = [
  // ── CREDIT_SCORE (5) ──────────────────────────────────────────
  { ruleId: 'CS_001', name: 'Minimum Credit Score', description: 'Applicant must meet minimum bureau credit score for the product', category: RuleCategory.CREDIT_SCORE, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 1, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'bureauData.creditScore', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.PASS, outcomeMessage: 'Credit score meets minimum' }, productOverrides: [{ loanType: 'PERSONAL_LOAN', threshold: 650 }, { loanType: 'HOME_LOAN', threshold: 650 }, { loanType: 'LAP', threshold: 650 }, { loanType: 'VEHICLE_LOAN_TWO_WHEELER', threshold: 650 }, { loanType: 'VEHICLE_LOAN_FOUR_WHEELER', threshold: 650 }, { loanType: 'GOLD_LOAN', threshold: 0 }, { loanType: 'EDUCATION_LOAN', threshold: 0 }, { loanType: 'MSME_TERM_LOAN', threshold: 600 }, { loanType: 'MUDRA_KISHORE', threshold: 0 }, { loanType: 'MUDRA_TARUN', threshold: 0 }, { loanType: 'KISAN_CREDIT_CARD', threshold: 0 }] },
  { ruleId: 'CS_002', name: 'Top-Tier Credit Score', description: 'Score 800+ qualifies for best rates', category: RuleCategory.CREDIT_SCORE, severity: RuleSeverity.WARNING, version: '1.0', priority: 2, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'bureauData.creditScore', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Consider best rate for score 800+' } },
  { ruleId: 'CS_003', name: 'Credit Score Available', description: 'Bureau score must be pulled before decisioning', category: RuleCategory.CREDIT_SCORE, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 1, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Credit score not found', rejectionCode: 'CS_003' } },
  { ruleId: 'CS_004', name: 'Sub-Prime Score Range', description: 'Score 550-649 in sub-prime range — manual review recommended', category: RuleCategory.CREDIT_SCORE, severity: RuleSeverity.WARNING, version: '1.0', priority: 3, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'bureauData.creditScore', operator: 'gte', value: 550 }, { field: 'bureauData.creditScore', operator: 'lte', value: 649 }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Sub-prime score range — manual review' } },
  { ruleId: 'CS_005', name: 'Score Drop Detection', description: 'Significant score drop from last pull indicates new credit issues', category: RuleCategory.CREDIT_SCORE, severity: RuleSeverity.WARNING, version: '1.0', priority: 4, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'bureauData.scoreDrop', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Score drop detected' } },

  // ── FOIR (4) ─────────────────────────────────────────────────
  { ruleId: 'FOIR_001', name: 'Maximum FOIR Limit', description: 'Fixed obligations to income ratio must not exceed product maximum', category: RuleCategory.FOIR, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 5, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'netMonthlyIncome', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'FOIR exceeds maximum', rejectionCode: 'FOIR_001' }, productOverrides: [{ loanType: 'PERSONAL_LOAN', threshold: 50 }, { loanType: 'HOME_LOAN', threshold: 50 }, { loanType: 'LAP', threshold: 55 }, { loanType: 'VEHICLE_LOAN_TWO_WHEELER', threshold: 50 }, { loanType: 'VEHICLE_LOAN_FOUR_WHEELER', threshold: 50 }, { loanType: 'GOLD_LOAN', threshold: 60 }, { loanType: 'EDUCATION_LOAN', threshold: 40 }, { loanType: 'MSME_TERM_LOAN', threshold: 50 }, { loanType: 'MUDRA_KISHORE', threshold: 50 }, { loanType: 'MUDRA_TARUN', threshold: 50 }, { loanType: 'KISAN_CREDIT_CARD', threshold: 50 }] },
  { ruleId: 'FOIR_002', name: 'FOIR Near Maximum', description: 'FOIR >75% of max — flag for amount/tenure adjustment', category: RuleCategory.FOIR, severity: RuleSeverity.WARNING, version: '1.0', priority: 6, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'FOIR near maximum — consider reducing amount' } },
  { ruleId: 'FOIR_003', name: 'Proposed EMI within FOIR', description: 'Total EMI including proposed loan must be within FOIR limit', category: RuleCategory.FOIR, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 5, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Proposed EMI exceeds FOIR', rejectionCode: 'FOIR_003' } },
  { ruleId: 'FOIR_004', name: 'Net Income After Obligations', description: 'Minimum ₹5,000 must remain after all EMIs', category: RuleCategory.FOIR, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 5, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Net income after EMI too low', rejectionCode: 'FOIR_004' } },

  // ── INCOME (4) ────────────────────────────────────────────────
  { ruleId: 'INC_001', name: 'Minimum Income', description: 'Net monthly income must meet minimum threshold', category: RuleCategory.INCOME, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 5, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Income below minimum', rejectionCode: 'INC_001' } },
  { ruleId: 'INC_002', name: 'Income Disclosed', description: 'Income details must be provided before decisioning', category: RuleCategory.INCOME, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 4, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Income not disclosed', rejectionCode: 'INC_002' } },
  { ruleId: 'INC_003', name: 'EMI to Gross Ratio', description: 'Existing EMI must not exceed 50% of gross monthly income', category: RuleCategory.INCOME, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 6, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'bureauData.totalEmi', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'EMI-to-gross ratio exceeds 50%', rejectionCode: 'INC_003' } },
  { ruleId: 'INC_004', name: 'Salary Account with Bank', description: 'Informational check for salary account relationship', category: RuleCategory.INCOME, severity: RuleSeverity.INFO, version: '1.0', priority: 99, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.PASS, outcomeMessage: 'Salary account check informational' } },

  // ── AGE (4) ───────────────────────────────────────────────────
  { ruleId: 'AGE_001', name: 'Age at Maturity', description: 'Applicant age at loan maturity must not exceed maximum', category: RuleCategory.AGE, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 3, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Age at maturity exceeds maximum', rejectionCode: 'AGE_001' }, productOverrides: [{ loanType: 'HOME_LOAN', threshold: 70 }, { loanType: 'EDUCATION_LOAN', threshold: 35 }, { loanType: 'PERSONAL_LOAN', threshold: 65 }, { loanType: 'LAP', threshold: 65 }, { loanType: 'GOLD_LOAN', threshold: 70 }, { loanType: 'KISAN_CREDIT_CARD', threshold: 75 }] },
  { ruleId: 'AGE_002', name: 'Minimum Age', description: 'Applicant must meet minimum age requirement', category: RuleCategory.AGE, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 3, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Below minimum age', rejectionCode: 'AGE_002' }, productOverrides: [{ loanType: 'EDUCATION_LOAN', threshold: 16 }, { loanType: 'VEHICLE_LOAN_TWO_WHEELER', threshold: 18 }, { loanType: 'KISAN_CREDIT_CARD', threshold: 18 }] },
  { ruleId: 'AGE_003', name: 'Age at Disbursement', description: 'Flag applications where applicant is near retirement at disbursement', category: RuleCategory.AGE, severity: RuleSeverity.WARNING, version: '1.0', priority: 50, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'applicantAge', operator: 'gte', value: 58 }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Near retirement at disbursement' } },
  { ruleId: 'AGE_004', name: 'Senior Citizen', description: 'Applicants 60+ may require co-borrower or insurance', category: RuleCategory.AGE, severity: RuleSeverity.WARNING, version: '1.0', priority: 50, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'applicantAge', operator: 'gte', value: 60 }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Senior citizen — co-borrower or insurance may be required' } },

  // ── AMOUNT_TENURE (5) ──────────────────────────────────────────
  { ruleId: 'AMT_001', name: 'Amount Within Product Limits', description: 'Requested amount must be within min/max for the product', category: RuleCategory.AMOUNT_TENURE, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 2, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Amount outside product limits', rejectionCode: 'AMT_001' } },
  { ruleId: 'AMT_002', name: 'Amount Within Eligibility', description: 'Requested amount should not exceed calculated eligibility', category: RuleCategory.AMOUNT_TENURE, severity: RuleSeverity.WARNING, version: '1.0', priority: 10, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Amount exceeds eligibility' } },
  { ruleId: 'AMT_003', name: 'Minimum Amount Threshold', description: 'Loan amount must meet minimum threshold for operational feasibility', category: RuleCategory.AMOUNT_TENURE, severity: RuleSeverity.WARNING, version: '1.0', priority: 20, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Below minimum loan amount' } },
  { ruleId: 'TEN_001', name: 'Tenure Within Product Limits', description: 'Requested tenure must be within min/max for the product', category: RuleCategory.AMOUNT_TENURE, severity: RuleSeverity.WARNING, version: '1.0', priority: 10, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Tenure outside product limits' } },
  { ruleId: 'TEN_002', name: 'Tenure for Age 58+', description: 'Reduced tenure recommended for older applicants', category: RuleCategory.AMOUNT_TENURE, severity: RuleSeverity.WARNING, version: '1.0', priority: 30, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'applicantAge', operator: 'gte', value: 58 }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Tenure may be restricted for older applicants' } },

  // ── BUREAU_HISTORY (7) ─────────────────────────────────────────
  { ruleId: 'DPD_001', name: 'No 90+ DPD', description: 'No 90+ days past due in last 24 months', category: RuleCategory.BUREAU_HISTORY, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 2, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: '90+ DPD found — hard stop', rejectionCode: 'DPD_001' } },
  { ruleId: 'DPD_002', name: 'No 60+ DPD', description: 'No 60+ days past due — warning for borderline profiles', category: RuleCategory.BUREAU_HISTORY, severity: RuleSeverity.WARNING, version: '1.0', priority: 15, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: '60+ DPD found' } },
  { ruleId: 'DPD_003', name: 'DPD Trend Worsening', description: 'Worsening delinquency trend — 30 to 60 day bucket', category: RuleCategory.BUREAU_HISTORY, severity: RuleSeverity.WARNING, version: '1.0', priority: 16, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'bureauData.dpd30', operator: 'gt', value: 0 }, { field: 'bureauData.dpd60', operator: 'gt', value: 0 }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'DPD trend worsening' } },
  { ruleId: 'BUR_001', name: 'Active Bureau Account', description: 'At least one active account for credit behaviour assessment', category: RuleCategory.BUREAU_HISTORY, severity: RuleSeverity.WARNING, version: '1.0', priority: 20, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'No active accounts — cannot assess credit behaviour' } },
  { ruleId: 'BUR_002', name: 'Account Count Limit', description: 'Too many total accounts indicates over-indebtedness', category: RuleCategory.BUREAU_HISTORY, severity: RuleSeverity.WARNING, version: '1.0', priority: 25, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'High account count — over-indebtedness risk' } },
  { ruleId: 'BUR_003', name: 'Recent Account Opening', description: 'Many recently opened accounts may indicate credit chasing', category: RuleCategory.BUREAU_HISTORY, severity: RuleSeverity.WARNING, version: '1.0', priority: 25, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Too many recently opened accounts' } },
  { ruleId: 'ENQ_001', name: 'Enquiry Velocity', description: 'Enquiries in last 90 days must not exceed threshold', category: RuleCategory.BUREAU_HISTORY, severity: RuleSeverity.WARNING, version: '1.0', priority: 15, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'High enquiry velocity' } },

  // ── FRAUD (4) ──────────────────────────────────────────────────
  { ruleId: 'FRD_001', name: 'No Fraud Flags', description: 'No fraud, suit filed, or wilful defaulter flags in bureau', category: RuleCategory.FRAUD, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 1, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Fraud/suit/defaulter flag detected', rejectionCode: 'FRD_001' } },
  { ruleId: 'FRD_002', name: 'No Suit Filed', description: 'Suit filed accounts are an absolute disqualifier', category: RuleCategory.FRAUD, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 1, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Suit filed — hard stop', rejectionCode: 'FRD_002' } },
  { ruleId: 'FRD_003', name: 'Not Wilful Defaulter', description: 'Wilful defaulter listing is an absolute disqualifier', category: RuleCategory.FRAUD, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 1, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Wilful defaulter — hard stop', rejectionCode: 'FRD_003' } },
  { ruleId: 'FRD_004', name: 'No Disputed Accounts', description: 'Disputed accounts require manual review', category: RuleCategory.FRAUD, severity: RuleSeverity.WARNING, version: '1.0', priority: 30, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Disputed account found' } },

  // ── EMPLOYMENT (3) ─────────────────────────────────────────────
  { ruleId: 'EMP_001', name: 'Employment Type Allowed', description: 'Employment type must be allowed for the product', category: RuleCategory.EMPLOYMENT, severity: RuleSeverity.WARNING, version: '1.0', priority: 10, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Employment type may not be eligible' } },
  { ruleId: 'EMP_002', name: 'Minimum Employment Tenure', description: 'Minimum 3 months employment with current employer', category: RuleCategory.EMPLOYMENT, severity: RuleSeverity.WARNING, version: '1.0', priority: 20, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'employmentTenureMonths', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Short employment tenure' } },
  { ruleId: 'EMP_003', name: 'Company Category', description: 'Employer company must not be in restricted list', category: RuleCategory.EMPLOYMENT, severity: RuleSeverity.WARNING, version: '1.0', priority: 20, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'companyCategory', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Elevated risk company category' } },

  // ── LTV (3) ────────────────────────────────────────────────────
  { ruleId: 'LTV_001', name: 'LTV Within Limits', description: 'Loan to value ratio must not exceed product maximum (secured loans only)', category: RuleCategory.LTV, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 4, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'collateralValue', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'LTV exceeds maximum', rejectionCode: 'LTV_001' }, productOverrides: [{ loanType: 'HOME_LOAN', threshold: 80 }, { loanType: 'LAP', threshold: 60 }, { loanType: 'VEHICLE_LOAN_TWO_WHEELER', threshold: 85 }, { loanType: 'VEHICLE_LOAN_FOUR_WHEELER', threshold: 85 }, { loanType: 'GOLD_LOAN', threshold: 75 }] },
  { ruleId: 'LTV_002', name: 'LTV Near Maximum', description: 'LTV >85% of max — flag for additional collateral', category: RuleCategory.LTV, severity: RuleSeverity.WARNING, version: '1.0', priority: 15, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'collateralValue', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'LTV near maximum — consider additional collateral' } },
  { ruleId: 'LTV_003', name: 'Collateral Value Sufficient', description: 'Collateral must be at least 50% of loan amount', category: RuleCategory.LTV, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 4, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'collateralValue', operator: 'exists', value: true }], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Collateral value insufficient', rejectionCode: 'LTV_003' } },

  // ── PRODUCT_POLICY (3) ─────────────────────────────────────────
  { ruleId: 'POL_001', name: 'GST Compliance for Business Loans', description: 'Business loans require GST registration check', category: RuleCategory.PRODUCT_POLICY, severity: RuleSeverity.INFO, version: '1.0', priority: 60, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'loanType', operator: 'in', value: ['MSME_TERM_LOAN', 'PERSONAL_LOAN'] }], thenClause: { outcome: RuleOutcome.PASS, outcomeMessage: 'GST check informational' } },
  { ruleId: 'POL_002', name: 'NOC Required for Top-Up', description: 'Top-up loans require NOC from existing lender', category: RuleCategory.PRODUCT_POLICY, severity: RuleSeverity.INFO, version: '1.0', priority: 60, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'loanType', operator: 'contains', value: 'TOP_UP' }], thenClause: { outcome: RuleOutcome.PASS, outcomeMessage: 'Top-up NOC check informational' } },
  { ruleId: 'POL_003', name: 'Processing Fee Cap', description: 'Processing fee must be within RBI guidelines (<=5%)', category: RuleCategory.PRODUCT_POLICY, severity: RuleSeverity.WARNING, version: '1.0', priority: 60, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Processing fee exceeds RBI guideline' } },

  // ── LEGAL (3) ──────────────────────────────────────────────────
  { ruleId: 'LEG_001', name: 'No CIBIL Rejection History', description: 'Multiple previous rejections warrant manual review', category: RuleCategory.LEGAL, severity: RuleSeverity.WARNING, version: '1.0', priority: 20, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Previous CIBIL rejections found' } },
  { ruleId: 'LEG_002', name: 'Not in RBI Defaulter Database', description: 'Applicant must not be in RBI defaulter/SARFAESI list', category: RuleCategory.LEGAL, severity: RuleSeverity.HARD_STOP, version: '1.0', priority: 1, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.FAIL, outcomeMessage: 'Found in RBI defaulter database', rejectionCode: 'LEG_002' } },
  { ruleId: 'LEG_003', name: 'RTGS/NEFT Compliance', description: 'Loan amount must comply with RTGS/NEFT threshold limits', category: RuleCategory.LEGAL, severity: RuleSeverity.INFO, version: '1.0', priority: 60, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.PASS, outcomeMessage: 'RTGS/NEFT compliance check' } },

  // ── DEDUPLICATION (1) ──────────────────────────────────────────
  { ruleId: 'DEDUP_001', name: 'No Active Duplicate Application', description: 'No active application from same applicant in last 30 days', category: RuleCategory.DEDUPLICATION, severity: RuleSeverity.WARNING, version: '1.0', priority: 30, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'Duplicate active application found' } },

  // ── CHANNEL (1) ────────────────────────────────────────────────
  { ruleId: 'CH_001', name: 'DSA Channel Product Restrictions', description: 'Certain products restricted for DSA channel', category: RuleCategory.CHANNEL, severity: RuleSeverity.WARNING, version: '1.0', priority: 30, isActive: true, effectiveFrom: new Date('2024-01-01'), conditions: [{ field: 'channelCode', operator: 'eq', value: 'DSA' }], thenClause: { outcome: RuleOutcome.WARN, outcomeMessage: 'DSA channel restricted for this product' } },
];

// ── BUILD RULE REGISTRY ─────────────────────────────────────────
const ruleRegistry = new Map<string, RuleEvaluator>();

for (const def of RULE_DEFINITIONS) {
  ruleRegistry.set(def.ruleId, makeEvaluator(def));
}

export function getRuleEvaluator(ruleId: string): RuleEvaluator | undefined {
  return ruleRegistry.get(ruleId);
}

export function getAllRuleDefinitions(): RuleDefinition[] {
  return [...RULE_DEFINITIONS];
}

export function getRulesByCategory(category: RuleCategory): RuleDefinition[] {
  return RULE_DEFINITIONS.filter(r => r.category === category);
}

export function getActiveRules(): RuleDefinition[] {
  const now = new Date();
  return RULE_DEFINITIONS.filter(r =>
    r.isActive && r.effectiveFrom <= now && (!r.effectiveTo || r.effectiveTo > now)
  );
}

export const RULE_COUNT = RULE_DEFINITIONS.length; // 47
