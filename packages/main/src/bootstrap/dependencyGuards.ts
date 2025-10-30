import fs from 'fs/promises';
import path from 'path';

/**
 * Checks the license of a critical dependency to ensure compliance.
 * @param packageName The name of the package to check.
 * @param expectedLicense The expected license (e.g., 'MIT').
 */
async function checkDependencyLicense(packageName: string, expectedLicense: string): Promise<void> {
  try {
    // Find the package's entry point
    const packageEntryPoint = require.resolve(packageName);

    // Find the package.json by traversing up from the entry point
    let currentDir = path.dirname(packageEntryPoint);
    let packageJsonPath: string | null = null;

    while (currentDir !== path.parse(currentDir).root) {
      const potentialPath = path.join(currentDir, 'package.json');
      try {
        await fs.access(potentialPath);
        const content = JSON.parse(await fs.readFile(potentialPath, 'utf-8'));
        if (content.name === packageName) {
          packageJsonPath = potentialPath;
          break;
        }
      } catch {
        // File doesn't exist, continue up
      }
      currentDir = path.dirname(currentDir);
    }

    if (!packageJsonPath) {
      throw new Error(`Could not find package.json for '${packageName}'.`);
    }

    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    if (packageJson.license !== expectedLicense) {
      throw new Error(
        `Invalid license for '${packageName}'. Expected '${expectedLicense}' but found '${packageJson.license}'. The application will not start.`
      );
    }

    console.log(`[DependencyGuard] License check passed for '${packageName}'.`);

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
  await checkDependencyLicense('acfundanmu.js', 'MIT');
  // Add other guards here if needed
}
