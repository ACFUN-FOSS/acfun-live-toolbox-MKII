import fs from 'fs/promises';
import path from 'path';

/**
 * Checks the license of a critical dependency to ensure compliance.
 * @param packageName The name of the package to check.
 * @param expectedLicense The expected license (e.g., 'MIT').
 */
async function checkDependencyLicense(packageName: string, expectedLicenses: string[]): Promise<void> {
  try {
    // Resolve package.json directly to avoid requiring the entry file
    const packageJsonResolved = require.resolve(`${packageName}/package.json`);
    const packageJson = JSON.parse(await fs.readFile(packageJsonResolved, 'utf-8'));

    const license: string | undefined = packageJson.license || (Array.isArray(packageJson.licenses) ? packageJson.licenses[0]?.type : undefined);
    if (!license) {
      throw new Error(`License field missing for '${packageName}'.`);
    }

    if (!expectedLicenses.includes(license)) {
      throw new Error(
        `Invalid license for '${packageName}'. Expected one of '${expectedLicenses.join(', ')}' but found '${license}'. The application will not start.`
      );
    }

    console.log(`[DependencyGuard] License check passed for '${packageName}' (license: ${license}).`);

  } catch (error: any) {
    console.error(`[DependencyGuard] Critical dependency check failed: ${error.message}`);
    // In a real app, you'd want to use Electron's dialog to show an error and quit.
    // For now, we'll re-throw to halt the startup process.
    throw error;
  }
}

/**
 * Runs all critical dependency checks required before the application can safely start.
 */
export async function runDependencyGuards(): Promise<void> {
  await checkDependencyLicense('acfunlive-http-api', ['MIT', 'Apache-2.0']);
  // Add other guards here if needed
}
