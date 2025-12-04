import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { APP_CONFIG } from './core/config/app-config';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly title = inject(Title);

  constructor() {
    this.title.setTitle(APP_CONFIG.metadata.title);
  }
}
