import { NgOptimizedImage } from '@angular/common';
import { Component, input, InputSignal } from '@angular/core';

@Component({
  selector: 'app-image',
  imports: [NgOptimizedImage],
  templateUrl: './image.html',
  styleUrl: './image.scss',
})
export class Image {
  private static readonly LOGO_URL = 'images/lcv_logo.png';
  public readonly imageUrl: InputSignal<string> = input(Image.LOGO_URL);
}
