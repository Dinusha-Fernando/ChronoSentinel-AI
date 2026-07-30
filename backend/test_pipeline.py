import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import AsyncSessionLocal
from backend.app.services.pipeline import analyze_domain_pipeline
from backend.app.utils.logger import logger

async def test_pipeline():
    logger.info("Starting D.H.R. pipeline integration test...")
    async with AsyncSessionLocal() as db:
        try:
            # Let's analyze a mock gambling domain
            domain = "betting-casino-slots-demo.test"
            logger.info(f"Running pipeline for domain: {domain}")
            result = await analyze_domain_pipeline(domain, force_refresh=True, db=db)
            
            logger.info("\n=== PIPELINE SUCCESS ===")
            logger.info(f"Domain: {result['domain']}")
            logger.info(f"Risk Score: {result['risk_score']}")
            logger.info(f"Risk Level: {result['risk_level']}")
            logger.info(f"Primary Category: {result['primary_category']}")
            logger.info(f"AI Confidence: {result.get('ai_confidence')}")
            logger.info(f"Risk Narrative: {result['risk_narrative']}")
            logger.info(f"Threat Overall: {result.get('threat_overall')}")
            logger.info(f"Snapshots checked: {result['snapshots_checked']}")
            logger.info(f"Timeline entries: {len(result.get('timeline', []))}")
            logger.info(f"Threat Intel entries: {len(result.get('threat_intel', []))}")
            
            # Print a timeline summary
            logger.info("\n=== TIMELINE SUMMARY ===")
            for entry in result.get('timeline', []):
                logger.info(f"Year {entry['year']} | Cat: {entry['category']} | Avg Risk: {entry['risk_score']} | Msg: {entry['summary']}")
                
        except Exception as e:
            logger.error(f"Pipeline test failed with exception: {e}", exc_info=True)

if __name__ == "__main__":
    asyncio.run(test_pipeline())
