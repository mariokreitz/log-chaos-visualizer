// filepath: /Users/mariokreitz/dev/github/log-chaos-visualizer/src/app/pages/about/about.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { APP_CONFIG } from '../../core/config/app-config';
import { Image } from '../../shared/components/image/image';

@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Image],
})
export default class About {
  readonly appMetadata = APP_CONFIG.metadata;
}
